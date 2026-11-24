import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  hashPassword,
  setAuthCookie,
  signAuthToken,
  verifyAuthToken,
  verifyCsrfHeader,
  verifyPassword,
} from './server/auth';
import type { AuthenticatedRequest } from './server/auth';
import { createDataStore } from './server/store';
import type { InquiryStatus, PostStatus, ProgramLevel, SiteSettings, UserRole } from './src/types';
import { calculateReadingTime, isValidEmail, sanitizeUrl, slugify } from './src/utils/cmsUtils';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_UPLOAD_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const ALLOWED_UPLOAD_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_UPLOAD_EXTS.has(ext) ? ext : '.bin';
      const token = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${token}${safeExt}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_EXTS.has(ext) && ALLOWED_UPLOAD_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP images and PDF files are permitted.'));
    }
  },
});

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function startServer() {
  const store = await createDataStore();
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Serve uploaded files safely with path confinement and nosniff header
  app.get('/uploads/:filename', (req: Request, res: Response) => {
    const rawName = path.basename(String(req.params.filename || ''));
    const resolved = path.resolve(UPLOADS_DIR, rawName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(resolved);
  });

  // Auth middleware helpers
  const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const payload = verifyAuthToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return;
    }
    const user = await store.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }
    const { password_hash: _pw, ...safeUser } = user;
    req.user = safeUser;
    next();
  };

  const requireSuperAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user || req.user.role !== 'super_admin') {
      res.status(403).json({ error: 'Super Admin privileges required.' });
      return;
    }
    next();
  };

  // Apply CSRF protection to all state-changing API routes
  app.use('/api', verifyCsrfHeader);

  // ==================== PUBLIC API ROUTES ====================

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', storage: store.mode });
  });

  app.get('/api/settings', async (_req, res) => {
    const settings = await store.getSettings();
    res.json(settings);
  });

  app.get('/api/categories', async (_req, res) => {
    const categories = await store.listCategories();
    res.json(categories);
  });

  app.get('/api/posts', async (req, res) => {
    const posts = await store.listPosts({ status: 'published' });
    const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let filtered = posts;
    if (category && category !== 'all') {
      filtered = filtered.filter((p) => (p.category_slug || '').toLowerCase() === category);
    }
    if (tag) {
      filtered = filtered.filter((p) =>
        p.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .includes(tag)
      );
    }
    if (q) {
      filtered = filtered.filter((p) =>
        `${p.title} ${p.excerpt} ${p.content} ${p.tags} ${p.author_name || ''}`
          .toLowerCase()
          .includes(q)
      );
    }
    res.json(filtered);
  });

  app.get('/api/posts/:slug', async (req, res) => {
    const slug = String(req.params.slug || '').trim();
    const post = await store.getPostBySlug(slug);
    if (!post || post.status !== 'published') {
      res.status(404).json({ error: 'Article not found.' });
      return;
    }
    const allPublished = await store.listPosts({ status: 'published' });
    const related = allPublished
      .filter((p) => p.id !== post.id)
      .sort((a, b) => {
        const sameCatA = a.category_id === post.category_id ? 1 : 0;
        const sameCatB = b.category_id === post.category_id ? 1 : 0;
        return sameCatB - sameCatA;
      })
      .slice(0, 3);
    res.json({ post, related });
  });

  app.get('/api/programs', async (_req, res) => {
    const programs = await store.listPrograms();
    res.json(programs);
  });

  app.get('/api/resources', async (_req, res) => {
    const resources = await store.listResources();
    res.json(resources);
  });

  // Download or preview institutional publication
  app.get('/api/resources/:id/download', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid resource ID.' });
      return;
    }
    const resource = await store.getResourceById(id);
    if (!resource) {
      res.status(404).json({ error: 'Publication not found.' });
      return;
    }

    // If resource points to an uploaded file on disk, serve it directly
    if (resource.file_url.startsWith('/uploads/')) {
      const safeName = path.basename(resource.file_url);
      const resolved = path.resolve(UPLOADS_DIR, safeName);
      if (resolved.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolved)) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.download(resolved, safeName);
        return;
      }
    }

    // Otherwise generate a clean institutional brief HTML sheet suitable for print/save
    const settings = await store.getSettings();
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtmlText(resource.title)} — ${escapeHtmlText(settings.institute_short_name)}</title>
  <style>
    body { font-family: Georgia, serif; color: #181F29; max-width: 780px; margin: 48px auto; padding: 0 24px; line-height: 1.7; }
    .header { border-bottom: 2px solid #181F29; padding-bottom: 18px; margin-bottom: 28px; }
    .kicker { font-family: sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #008398; font-weight: 600; }
    h1 { font-size: 28px; margin: 10px 0 8px; }
    .meta { font-family: sans-serif; font-size: 13px; color: #475569; }
    .summary { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px 24px; margin: 24px 0; }
    .footer { margin-top: 48px; border-top: 1px solid #CBD5E1; padding-top: 16px; font-family: sans-serif; font-size: 12px; color: #64748B; }
  </style>
</head>
<body>
  <div class="header">
    <div class="kicker">${escapeHtmlText(settings.institute_name)} · ${escapeHtmlText(resource.category)}</div>
    <h1>${escapeHtmlText(resource.title)}</h1>
    <div class="meta">Publication Year: ${escapeHtmlText(resource.publication_year)} · Format: ${escapeHtmlText(resource.file_size)}</div>
  </div>
  <div class="summary">
    <strong>Executive Overview</strong>
    <p>${escapeHtmlText(resource.summary)}</p>
  </div>
  <p>This official institutional document is published by the ${escapeHtmlText(settings.institute_name)} (${escapeHtmlText(settings.institute_short_name)}). For full printed prospectuses, certified syllabi, or institutional licensing inquiries, please contact the Office of Admissions and Academic Affairs.</p>
  <div class="footer">
    ${escapeHtmlText(settings.contact_address)} · ${escapeHtmlText(settings.contact_email_admissions)} · ${escapeHtmlText(settings.contact_phone_primary)}
  </div>
</body>
</html>`;
    const filename = `${slugify(resource.title) || 'gipt-publication'}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    res.send(html);
  });

  app.post('/api/subscribers', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const { subscriber, alreadyExists } = await store.addSubscriber(email);
    res.status(alreadyExists ? 200 : 201).json({
      subscriber,
      alreadyExists,
      message: alreadyExists
        ? 'This email address is already subscribed to GIPT intake alerts.'
        : 'Thank you for subscribing to GIPT intake alerts and research briefs.',
    });
  });

  app.post('/api/inquiries', async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const category = String(req.body?.category || 'General').trim();
    const program_of_interest = String(req.body?.program_of_interest || '').trim();
    const message = String(req.body?.message || '').trim();

    if (name.length < 2) {
      res.status(400).json({ error: 'Please provide your full name.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (message.length < 10) {
      res.status(400).json({ error: 'Please enter a message of at least 10 characters.' });
      return;
    }

    const inquiry = await store.createInquiry({
      name,
      email,
      phone,
      category,
      program_of_interest,
      message,
    });
    res.status(201).json({
      inquiry,
      message: 'Your inquiry has been received by the GIPT Admissions & Registry desk.',
    });
  });

  // ==================== AUTH ROUTES ====================

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await store.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signAuthToken({ userId: user.id, email: user.email, role: user.role });
    setAuthCookie(req, res, token);
    const { password_hash: _pw, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearAuthCookie(req, res);
    res.json({ success: true });
  });

  app.get('/api/auth/me', async (req, res) => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      res.json({ user: null });
      return;
    }
    const payload = verifyAuthToken(token);
    if (!payload) {
      res.json({ user: null });
      return;
    }
    const user = await store.getUserById(payload.userId);
    if (!user) {
      res.json({ user: null });
      return;
    }
    const { password_hash: _pw, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // ==================== PROTECTED ADMIN ROUTES ====================

  app.get('/api/admin/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
    const stats = await store.getDashboardStats();
    if (req.user?.role === 'author') {
      const ownPosts = await store.listPosts({ status: 'all', authorId: req.user.id });
      res.json({
        ...stats,
        published_posts: ownPosts.filter((p) => p.status === 'published').length,
        draft_posts: ownPosts.filter((p) => p.status === 'draft').length,
      });
      return;
    }
    res.json(stats);
  });

  // File upload (for post cover images, logos, and PDF publications)
  app.post('/api/admin/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        res.status(400).json({ error: msg });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file provided.' });
        return;
      }
      const sizeKb = req.file.size / 1024;
      const readableSize =
        sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(sizeKb))} KB`;
      res.status(201).json({
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename,
        size: readableSize,
        mimetype: req.file.mimetype,
      });
    });
  });

  // Self profile update (Super Admin & Author)
  app.put('/api/admin/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const name = String(req.body?.name || '').trim();
    const title = String(req.body?.title || '').trim();
    const bio = String(req.body?.bio || '').trim();
    const newPassword = String(req.body?.password || '');

    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }

    const updateData: Parameters<typeof store.updateUser>[1] = { name, title, bio };
    if (newPassword) {
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      updateData.password_hash = await hashPassword(newPassword);
    }

    const updated = await store.updateUser(userId, updateData);
    res.json({ user: updated });
  });

  // Posts CRUD (Authors manage own posts; Super Admins manage all)
  app.get('/api/admin/posts', requireAuth, async (req: AuthenticatedRequest, res) => {
    const isAuthor = req.user!.role === 'author';
    const posts = await store.listPosts({
      status: 'all',
      authorId: isAuthor ? req.user!.id : undefined,
    });
    res.json(posts);
  });

  app.post('/api/admin/posts', requireAuth, async (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (title.length < 3 || content.length < 10) {
      res.status(400).json({ error: 'Title and article body content are required.' });
      return;
    }
    const status: PostStatus = req.body?.status === 'published' ? 'published' : 'draft';
    const cover = sanitizeUrl(String(req.body?.cover_image || ''));
    const categoryId = req.body?.category_id ? Number(req.body.category_id) : null;
    const featured = req.user!.role === 'super_admin' ? Boolean(req.body?.featured) : false;

    const created = await store.createPost({
      title,
      slug: String(req.body?.slug || slugify(title)),
      excerpt: String(req.body?.excerpt || '').trim() || content.slice(0, 180).trim(),
      content,
      cover_image: cover,
      category_id: categoryId,
      author_id: req.user!.id,
      tags: String(req.body?.tags || '').trim(),
      reading_time: calculateReadingTime(content),
      featured,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    });
    res.status(201).json(created);
  });

  app.put('/api/admin/posts/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = await store.getPostById(id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    if (req.user!.role === 'author' && existing.author_id !== req.user!.id) {
      res.status(403).json({ error: 'You may only edit your own articles.' });
      return;
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.title;
    const content = req.body?.content !== undefined ? String(req.body.content).trim() : existing.content;
    if (title.length < 3 || content.length < 10) {
      res.status(400).json({ error: 'Title and article body content are required.' });
      return;
    }

    const status: PostStatus =
      req.body?.status === 'published'
        ? 'published'
        : req.body?.status === 'draft'
        ? 'draft'
        : existing.status;

    const updated = await store.updatePost(id, {
      title,
      slug: req.body?.slug !== undefined ? String(req.body.slug).trim() : existing.slug,
      excerpt: req.body?.excerpt !== undefined ? String(req.body.excerpt).trim() : existing.excerpt,
      content,
      cover_image:
        req.body?.cover_image !== undefined
          ? sanitizeUrl(String(req.body.cover_image))
          : existing.cover_image,
      category_id:
        req.body?.category_id !== undefined
          ? req.body.category_id
            ? Number(req.body.category_id)
            : null
          : existing.category_id,
      tags: req.body?.tags !== undefined ? String(req.body.tags).trim() : existing.tags,
      reading_time: calculateReadingTime(content),
      featured:
        req.user!.role === 'super_admin' && req.body?.featured !== undefined
          ? Boolean(req.body.featured)
          : existing.featured,
      status,
    });
    res.json(updated);
  });

  app.delete('/api/admin/posts/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const existing = await store.getPostById(id);
    if (!existing) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    if (req.user!.role === 'author' && existing.author_id !== req.user!.id) {
      res.status(403).json({ error: 'You may only delete your own articles.' });
      return;
    }
    await store.deletePost(id);
    res.json({ success: true });
  });

  // Categories CRUD (Super Admin only for write)
  app.post('/api/admin/categories', requireAuth, requireSuperAdmin, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const slug = slugify(String(req.body?.slug || name));
    const description = String(req.body?.description || '').trim();
    try {
      const created = await store.createCategory({ name, slug, description });
      res.status(201).json(created);
    } catch {
      res.status(400).json({ error: 'A category with that slug already exists.' });
    }
  });

  app.put('/api/admin/categories/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body?.name || '').trim();
    if (name.length < 2) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const slug = slugify(String(req.body?.slug || name));
    const description = String(req.body?.description || '').trim();
    const updated = await store.updateCategory(id, { name, slug, description });
    if (!updated) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/admin/categories/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const ok = await store.deleteCategory(id);
    if (!ok) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Programs CRUD (Super Admin only)
  app.post('/api/admin/programs', requireAuth, requireSuperAdmin, async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const level = req.body?.level as ProgramLevel;
    if (title.length < 3 || !['undergraduate', 'postgraduate', 'short_course'].includes(level)) {
      res.status(400).json({ error: 'Valid program title and academic level are required.' });
      return;
    }
    const created = await store.createProgram({
      title,
      slug: slugify(String(req.body?.slug || title)),
      level,
      faculty: String(req.body?.faculty || '').trim(),
      duration: String(req.body?.duration || '').trim(),
      study_mode: String(req.body?.study_mode || '').trim(),
      entry_requirements: String(req.body?.entry_requirements || '').trim(),
      summary: String(req.body?.summary || '').trim(),
      highlights: String(req.body?.highlights || '').trim(),
      intake: String(req.body?.intake || '').trim(),
      featured: Boolean(req.body?.featured),
    });
    res.status(201).json(created);
  });

  app.put('/api/admin/programs/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await store.updateProgram(id, {
      title: req.body?.title !== undefined ? String(req.body.title).trim() : undefined,
      level: req.body?.level,
      faculty: req.body?.faculty !== undefined ? String(req.body.faculty).trim() : undefined,
      duration: req.body?.duration !== undefined ? String(req.body.duration).trim() : undefined,
      study_mode: req.body?.study_mode !== undefined ? String(req.body.study_mode).trim() : undefined,
      entry_requirements:
        req.body?.entry_requirements !== undefined
          ? String(req.body.entry_requirements).trim()
          : undefined,
      summary: req.body?.summary !== undefined ? String(req.body.summary).trim() : undefined,
      highlights: req.body?.highlights !== undefined ? String(req.body.highlights).trim() : undefined,
      intake: req.body?.intake !== undefined ? String(req.body.intake).trim() : undefined,
      featured: req.body?.featured !== undefined ? Boolean(req.body.featured) : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Program not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/admin/programs/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteProgram(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Program not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Resources CRUD (Super Admin only)
  app.post('/api/admin/resources', requireAuth, requireSuperAdmin, async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const category = String(req.body?.category || '').trim();
    if (title.length < 3 || !category) {
      res.status(400).json({ error: 'Publication title and category are required.' });
      return;
    }
    const created = await store.createResource({
      title,
      category,
      summary: String(req.body?.summary || '').trim(),
      file_url: sanitizeUrl(String(req.body?.file_url || '')),
      publication_year: String(req.body?.publication_year || new Date().getFullYear()).trim(),
      file_size: String(req.body?.file_size || '1.0 MB PDF').trim(),
    });
    res.status(201).json(created);
  });

  app.put('/api/admin/resources/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await store.updateResource(id, {
      title: req.body?.title !== undefined ? String(req.body.title).trim() : undefined,
      category: req.body?.category !== undefined ? String(req.body.category).trim() : undefined,
      summary: req.body?.summary !== undefined ? String(req.body.summary).trim() : undefined,
      file_url:
        req.body?.file_url !== undefined ? sanitizeUrl(String(req.body.file_url)) : undefined,
      publication_year:
        req.body?.publication_year !== undefined
          ? String(req.body.publication_year).trim()
          : undefined,
      file_size: req.body?.file_size !== undefined ? String(req.body.file_size).trim() : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Publication not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/admin/resources/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteResource(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Publication not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Inquiries & Subscribers (Super Admin only)
  app.get('/api/admin/inquiries', requireAuth, requireSuperAdmin, async (_req, res) => {
    res.json(await store.listInquiries());
  });

  app.put('/api/admin/inquiries/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status as InquiryStatus | undefined;
    if (status && !['new', 'in_progress', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'Invalid inquiry status.' });
      return;
    }
    const updated = await store.updateInquiry(id, {
      status,
      admin_notes:
        req.body?.admin_notes !== undefined ? String(req.body.admin_notes).trim() : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Inquiry not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/admin/inquiries/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteInquiry(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Inquiry not found.' });
      return;
    }
    res.json({ success: true });
  });

  app.get('/api/admin/subscribers', requireAuth, requireSuperAdmin, async (_req, res) => {
    res.json(await store.listSubscribers());
  });

  app.delete('/api/admin/subscribers/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteSubscriber(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Subscriber not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Users & Authors CRUD (Super Admin only)
  app.get('/api/admin/users', requireAuth, requireSuperAdmin, async (_req, res) => {
    res.json(await store.listUsers());
  });

  app.post('/api/admin/users', requireAuth, requireSuperAdmin, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role: UserRole = req.body?.role === 'super_admin' ? 'super_admin' : 'author';
    const title = String(req.body?.title || '').trim();
    const bio = String(req.body?.bio || '').trim();

    if (name.length < 2 || !isValidEmail(email) || password.length < 8) {
      res
        .status(400)
        .json({ error: 'Valid name, email, and password (min 8 characters) are required.' });
      return;
    }

    const existing = await store.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const password_hash = await hashPassword(password);
    const created = await store.createUser({ name, email, password_hash, role, title, bio });
    res.status(201).json(created);
  });

  app.put('/api/admin/users/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updateData: Parameters<typeof store.updateUser>[1] = {};
    if (req.body?.name !== undefined) updateData.name = String(req.body.name).trim();
    if (req.body?.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Valid email is required.' });
        return;
      }
      updateData.email = email;
    }
    if (req.body?.role === 'super_admin' || req.body?.role === 'author') {
      updateData.role = req.body.role;
    }
    if (req.body?.title !== undefined) updateData.title = String(req.body.title).trim();
    if (req.body?.bio !== undefined) updateData.bio = String(req.body.bio).trim();
    if (req.body?.password) {
      const pw = String(req.body.password);
      if (pw.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      updateData.password_hash = await hashPassword(pw);
    }

    const updated = await store.updateUser(id, updateData);
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/admin/users/:id', requireAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) {
      res.status(400).json({ error: 'You cannot delete your own active account.' });
      return;
    }
    const ok = await store.deleteUser(id);
    if (!ok) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Site Settings (Super Admin only)
  app.put('/api/admin/settings', requireAuth, requireSuperAdmin, async (req, res) => {
    const current = await store.getSettings();
    const incoming = req.body as Partial<SiteSettings>;
    const sanitizedSlides = Array.isArray(incoming.hero_slides)
      ? incoming.hero_slides.map((s) => ({
          ...s,
          image_url: sanitizeUrl(s.image_url),
          primary_cta_link: sanitizeUrl(s.primary_cta_link) || '/programs',
          secondary_cta_link: sanitizeUrl(s.secondary_cta_link) || '/#knowledge-hub',
        }))
      : current.hero_slides;

    const merged: SiteSettings = {
      ...current,
      ...incoming,
      hero_slides: sanitizedSlides,
      logo_url: incoming.logo_url !== undefined ? sanitizeUrl(incoming.logo_url) : current.logo_url,
      announcement_link_url:
        incoming.announcement_link_url !== undefined
          ? sanitizeUrl(incoming.announcement_link_url) || '/programs'
          : current.announcement_link_url,
      social_linkedin:
        incoming.social_linkedin !== undefined
          ? sanitizeUrl(incoming.social_linkedin)
          : current.social_linkedin,
      social_twitter:
        incoming.social_twitter !== undefined
          ? sanitizeUrl(incoming.social_twitter)
          : current.social_twitter,
      social_facebook:
        incoming.social_facebook !== undefined
          ? sanitizeUrl(incoming.social_facebook)
          : current.social_facebook,
      social_youtube:
        incoming.social_youtube !== undefined
          ? sanitizeUrl(incoming.social_youtube)
          : current.social_youtube,
    };
    const updated = await store.updateSettings(merged);
    res.json(updated);
  });

  // 404 for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // ==================== FRONTEND SERVING ====================

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GIPT] Server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[GIPT] Failed to start server:', err);
  process.exit(1);
});
