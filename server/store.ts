import mysql from 'mysql2/promise';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  Category,
  DashboardStats,
  Inquiry,
  InquiryStatus,
  Post,
  PostStatus,
  Program,
  ProgramLevel,
  Resource,
  SiteSettings,
  Subscriber,
  User,
  UserRole,
} from '../src/types';
import { calculateReadingTime, slugify } from '../src/utils/cmsUtils';
import { hashPassword } from './auth';
import {
  INITIAL_CATEGORIES,
  INITIAL_INQUIRIES,
  INITIAL_POSTS,
  INITIAL_PROGRAMS,
  INITIAL_RESOURCES,
  INITIAL_SITE_SETTINGS,
  INITIAL_SUBSCRIBERS,
} from './seedData';

export interface StoredUser extends User {
  password_hash: string;
}

export interface DataStore {
  mode: 'mysql' | 'memory';
  init(): Promise<void>;

  // Users
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserById(id: number): Promise<StoredUser | null>;
  listUsers(): Promise<User[]>;
  createUser(data: {
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    title: string;
    bio: string;
    avatar_url?: string;
  }): Promise<User>;
  updateUser(
    id: number,
    data: Partial<{
      name: string;
      email: string;
      password_hash: string;
      role: UserRole;
      title: string;
      bio: string;
      avatar_url: string;
    }>
  ): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;

  // Categories
  listCategories(): Promise<Category[]>;
  createCategory(data: { name: string; slug: string; description: string }): Promise<Category>;
  updateCategory(id: number, data: { name: string; slug: string; description: string }): Promise<Category | null>;
  deleteCategory(id: number): Promise<boolean>;

  // Posts
  listPosts(options?: { status?: PostStatus | 'all'; authorId?: number }): Promise<Post[]>;
  getPostBySlug(slug: string): Promise<Post | null>;
  getPostById(id: number): Promise<Post | null>;
  createPost(data: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    cover_image: string;
    category_id: number | null;
    author_id: number;
    tags: string;
    reading_time: number;
    featured: boolean;
    status: PostStatus;
    published_at: string | null;
  }): Promise<Post>;
  updatePost(
    id: number,
    data: Partial<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      cover_image: string;
      category_id: number | null;
      tags: string;
      reading_time: number;
      featured: boolean;
      status: PostStatus;
      published_at: string | null;
    }>
  ): Promise<Post | null>;
  deletePost(id: number): Promise<boolean>;

  // Programs
  listPrograms(): Promise<Program[]>;
  getProgramById(id: number): Promise<Program | null>;
  createProgram(data: Omit<Program, 'id' | 'created_at'>): Promise<Program>;
  updateProgram(id: number, data: Partial<Omit<Program, 'id' | 'created_at'>>): Promise<Program | null>;
  deleteProgram(id: number): Promise<boolean>;

  // Resources
  listResources(): Promise<Resource[]>;
  getResourceById(id: number): Promise<Resource | null>;
  createResource(data: Omit<Resource, 'id' | 'created_at'>): Promise<Resource>;
  updateResource(id: number, data: Partial<Omit<Resource, 'id' | 'created_at'>>): Promise<Resource | null>;
  deleteResource(id: number): Promise<boolean>;

  // Inquiries
  listInquiries(): Promise<Inquiry[]>;
  createInquiry(data: Omit<Inquiry, 'id' | 'status' | 'admin_notes' | 'created_at'>): Promise<Inquiry>;
  updateInquiry(id: number, data: { status?: InquiryStatus; admin_notes?: string }): Promise<Inquiry | null>;
  deleteInquiry(id: number): Promise<boolean>;

  // Subscribers
  listSubscribers(): Promise<Subscriber[]>;
  addSubscriber(email: string): Promise<{ subscriber: Subscriber; alreadyExists: boolean }>;
  deleteSubscriber(id: number): Promise<boolean>;

  // Site Settings
  getSettings(): Promise<SiteSettings>;
  updateSettings(settings: SiteSettings): Promise<SiteSettings>;

  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;
}

function stripPassword(u: StoredUser): User {
  const { password_hash: _pw, ...safe } = u;
  return safe;
}

function getSeedAdminCredentials(): { email: string; password: string } {
  const email = (process.env.ADMIN_EMAIL || 'admin@gipt.edu.mw').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@1234';
  return { email, password };
}

class MemoryStore implements DataStore {
  mode: 'memory' = 'memory';
  private users: StoredUser[] = [];
  private categories: Category[] = [];
  private posts: Post[] = [];
  private programs: Program[] = [];
  private resources: Resource[] = [];
  private inquiries: Inquiry[] = [];
  private subscribers: Subscriber[] = [];
  private settings: SiteSettings = structuredClone(INITIAL_SITE_SETTINGS);
  private seq = {
    users: 1,
    categories: 1,
    posts: 1,
    programs: 1,
    resources: 1,
    inquiries: 1,
    subscribers: 1,
  };

  async init(): Promise<void> {
    if (this.users.length > 0) return;

    const now = new Date().toISOString();
    const adminCreds = getSeedAdminCredentials();
    const adminHash = await hashPassword(adminCreds.password);
    const editorHash = await hashPassword('Author@1234');

    this.users.push(
      {
        id: this.seq.users++,
        name: 'Prof. Hastings Chikwanda',
        email: adminCreds.email,
        password_hash: adminHash,
        role: 'super_admin',
        title: 'Principal & Senior Policy Fellow',
        bio: 'Development economist and Principal of GIPT specializing in public financial management, sovereign debt oversight, and regional higher education strategy.',
        avatar_url: '',
        created_at: now,
      },
      {
        id: this.seq.users++,
        name: 'Dr. Grace Nkhoma',
        email: 'editor@gipt.edu.mw',
        password_hash: editorHash,
        role: 'author',
        title: 'Deputy Principal, Academic Affairs & Research',
        bio: 'Higher education strategist and governance researcher overseeing curriculum innovation, blended executive pedagogy, and academic quality assurance.',
        avatar_url: '',
        created_at: now,
      }
    );

    for (const c of INITIAL_CATEGORIES) {
      this.categories.push({ id: this.seq.categories++, ...c, created_at: now });
    }

    for (const p of INITIAL_PROGRAMS) {
      this.programs.push({ id: this.seq.programs++, ...p, created_at: now });
    }

    for (const r of INITIAL_RESOURCES) {
      this.resources.push({ id: this.seq.resources++, ...r, created_at: now });
    }

    for (const post of INITIAL_POSTS) {
      const cat = this.categories.find((c) => c.slug === post.category_slug);
      const author =
        this.users.find((u) => u.email === post.author_email) || this.users[0];
      this.posts.push({
        id: this.seq.posts++,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        cover_image: post.cover_image,
        category_id: cat ? cat.id : null,
        author_id: author.id,
        tags: post.tags,
        reading_time: calculateReadingTime(post.content),
        featured: post.featured,
        status: post.status,
        published_at: post.published_at,
        created_at: post.published_at,
        updated_at: post.published_at,
      });
    }

    for (const inq of INITIAL_INQUIRIES) {
      this.inquiries.push({ id: this.seq.inquiries++, ...inq, created_at: now });
    }

    for (const sub of INITIAL_SUBSCRIBERS) {
      this.subscribers.push({ id: this.seq.subscribers++, ...sub, created_at: now });
    }
  }

  private enrichPost(post: Post): Post {
    const cat = this.categories.find((c) => c.id === post.category_id);
    const author = this.users.find((u) => u.id === post.author_id);
    return {
      ...post,
      category_name: cat?.name || 'Uncategorized',
      category_slug: cat?.slug || 'uncategorized',
      author_name: author?.name || 'GIPT Editorial Desk',
      author_title: author?.title || 'Faculty & Research',
      author_bio: author?.bio || '',
    };
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const target = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === target) || null;
  }

  async getUserById(id: number): Promise<StoredUser | null> {
    return this.users.find((u) => u.id === id) || null;
  }

  async listUsers(): Promise<User[]> {
    return this.users.map(stripPassword);
  }

  async createUser(data: {
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    title: string;
    bio: string;
    avatar_url?: string;
  }): Promise<User> {
    const user: StoredUser = {
      id: this.seq.users++,
      name: data.name,
      email: data.email.trim().toLowerCase(),
      password_hash: data.password_hash,
      role: data.role,
      title: data.title,
      bio: data.bio,
      avatar_url: data.avatar_url || '',
      created_at: new Date().toISOString(),
    };
    this.users.push(user);
    return stripPassword(user);
  }

  async updateUser(
    id: number,
    data: Partial<{
      name: string;
      email: string;
      password_hash: string;
      role: UserRole;
      title: string;
      bio: string;
      avatar_url: string;
    }>
  ): Promise<User | null> {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    if (data.name !== undefined) user.name = data.name;
    if (data.email !== undefined) user.email = data.email.trim().toLowerCase();
    if (data.password_hash !== undefined) user.password_hash = data.password_hash;
    if (data.role !== undefined) user.role = data.role;
    if (data.title !== undefined) user.title = data.title;
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.avatar_url !== undefined) user.avatar_url = data.avatar_url;
    return stripPassword(user);
  }

  async deleteUser(id: number): Promise<boolean> {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }

  async listCategories(): Promise<Category[]> {
    return [...this.categories].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(data: { name: string; slug: string; description: string }): Promise<Category> {
    const cat: Category = {
      id: this.seq.categories++,
      name: data.name,
      slug: data.slug || slugify(data.name),
      description: data.description,
      created_at: new Date().toISOString(),
    };
    this.categories.push(cat);
    return cat;
  }

  async updateCategory(
    id: number,
    data: { name: string; slug: string; description: string }
  ): Promise<Category | null> {
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) return null;
    cat.name = data.name;
    cat.slug = data.slug || slugify(data.name);
    cat.description = data.description;
    return { ...cat };
  }

  async deleteCategory(id: number): Promise<boolean> {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.categories.splice(idx, 1);
    this.posts.forEach((p) => {
      if (p.category_id === id) p.category_id = null;
    });
    return true;
  }

  async listPosts(options?: { status?: PostStatus | 'all'; authorId?: number }): Promise<Post[]> {
    let list = [...this.posts];
    if (options?.status && options.status !== 'all') {
      list = list.filter((p) => p.status === options.status);
    }
    if (options?.authorId !== undefined) {
      list = list.filter((p) => p.author_id === options.authorId);
    }
    list.sort((a, b) => {
      const da = new Date(a.published_at || a.created_at).getTime();
      const db = new Date(b.published_at || b.created_at).getTime();
      return db - da;
    });
    return list.map((p) => this.enrichPost(p));
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    const post = this.posts.find((p) => p.slug === slug);
    return post ? this.enrichPost(post) : null;
  }

  async getPostById(id: number): Promise<Post | null> {
    const post = this.posts.find((p) => p.id === id);
    return post ? this.enrichPost(post) : null;
  }

  async createPost(data: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    cover_image: string;
    category_id: number | null;
    author_id: number;
    tags: string;
    reading_time: number;
    featured: boolean;
    status: PostStatus;
    published_at: string | null;
  }): Promise<Post> {
    const now = new Date().toISOString();
    let baseSlug = slugify(data.slug || data.title) || `post-${this.seq.posts}`;
    let finalSlug = baseSlug;
    let counter = 2;
    while (this.posts.some((p) => p.slug === finalSlug)) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    const post: Post = {
      id: this.seq.posts++,
      ...data,
      slug: finalSlug,
      published_at: data.status === 'published' ? data.published_at || now : null,
      created_at: now,
      updated_at: now,
    };
    this.posts.push(post);
    return this.enrichPost(post);
  }

  async updatePost(
    id: number,
    data: Partial<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      cover_image: string;
      category_id: number | null;
      tags: string;
      reading_time: number;
      featured: boolean;
      status: PostStatus;
      published_at: string | null;
    }>
  ): Promise<Post | null> {
    const post = this.posts.find((p) => p.id === id);
    if (!post) return null;

    if (data.slug !== undefined && data.slug !== post.slug) {
      let baseSlug = slugify(data.slug || post.title) || `post-${post.id}`;
      let finalSlug = baseSlug;
      let counter = 2;
      while (this.posts.some((p) => p.id !== id && p.slug === finalSlug)) {
        finalSlug = `${baseSlug}-${counter++}`;
      }
      post.slug = finalSlug;
    }

    if (data.title !== undefined) post.title = data.title;
    if (data.excerpt !== undefined) post.excerpt = data.excerpt;
    if (data.content !== undefined) post.content = data.content;
    if (data.cover_image !== undefined) post.cover_image = data.cover_image;
    if (data.category_id !== undefined) post.category_id = data.category_id;
    if (data.tags !== undefined) post.tags = data.tags;
    if (data.reading_time !== undefined) post.reading_time = data.reading_time;
    if (data.featured !== undefined) post.featured = data.featured;
    if (data.status !== undefined) {
      post.status = data.status;
      if (data.status === 'published' && !post.published_at) {
        post.published_at = data.published_at || new Date().toISOString();
      } else if (data.status === 'draft') {
        post.published_at = null;
      }
    }
    post.updated_at = new Date().toISOString();
    return this.enrichPost(post);
  }

  async deletePost(id: number): Promise<boolean> {
    const idx = this.posts.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.posts.splice(idx, 1);
    return true;
  }

  async listPrograms(): Promise<Program[]> {
    return [...this.programs];
  }

  async getProgramById(id: number): Promise<Program | null> {
    return this.programs.find((p) => p.id === id) || null;
  }

  async createProgram(data: Omit<Program, 'id' | 'created_at'>): Promise<Program> {
    const item: Program = {
      id: this.seq.programs++,
      ...data,
      slug: data.slug || slugify(data.title),
      created_at: new Date().toISOString(),
    };
    this.programs.push(item);
    return item;
  }

  async updateProgram(
    id: number,
    data: Partial<Omit<Program, 'id' | 'created_at'>>
  ): Promise<Program | null> {
    const item = this.programs.find((p) => p.id === id);
    if (!item) return null;
    Object.assign(item, data);
    if (data.title && !data.slug) {
      item.slug = slugify(data.title);
    }
    return { ...item };
  }

  async deleteProgram(id: number): Promise<boolean> {
    const idx = this.programs.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.programs.splice(idx, 1);
    return true;
  }

  async listResources(): Promise<Resource[]> {
    return [...this.resources];
  }

  async getResourceById(id: number): Promise<Resource | null> {
    return this.resources.find((r) => r.id === id) || null;
  }

  async createResource(data: Omit<Resource, 'id' | 'created_at'>): Promise<Resource> {
    const id = this.seq.resources++;
    const youtubeUrl = data.youtube_url || '';
    const fileUrl = data.file_url || (!youtubeUrl ? `/api/resources/${id}/download` : '');
    const item: Resource = {
      id,
      ...data,
      file_url: fileUrl,
      youtube_url: youtubeUrl,
      created_at: new Date().toISOString(),
    };
    this.resources.push(item);
    return item;
  }

  async updateResource(
    id: number,
    data: Partial<Omit<Resource, 'id' | 'created_at'>>
  ): Promise<Resource | null> {
    const item = this.resources.find((r) => r.id === id);
    if (!item) return null;
    Object.assign(item, data);
    return { ...item };
  }

  async deleteResource(id: number): Promise<boolean> {
    const idx = this.resources.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.resources.splice(idx, 1);
    return true;
  }

  async listInquiries(): Promise<Inquiry[]> {
    return [...this.inquiries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async createInquiry(
    data: Omit<Inquiry, 'id' | 'status' | 'admin_notes' | 'created_at'>
  ): Promise<Inquiry> {
    const item: Inquiry = {
      id: this.seq.inquiries++,
      ...data,
      status: 'new',
      admin_notes: '',
      created_at: new Date().toISOString(),
    };
    this.inquiries.unshift(item);
    return item;
  }

  async updateInquiry(
    id: number,
    data: { status?: InquiryStatus; admin_notes?: string }
  ): Promise<Inquiry | null> {
    const item = this.inquiries.find((i) => i.id === id);
    if (!item) return null;
    if (data.status !== undefined) item.status = data.status;
    if (data.admin_notes !== undefined) item.admin_notes = data.admin_notes;
    return { ...item };
  }

  async deleteInquiry(id: number): Promise<boolean> {
    const idx = this.inquiries.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    this.inquiries.splice(idx, 1);
    return true;
  }

  async listSubscribers(): Promise<Subscriber[]> {
    return [...this.subscribers].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async addSubscriber(email: string): Promise<{ subscriber: Subscriber; alreadyExists: boolean }> {
    const clean = email.trim().toLowerCase();
    const existing = this.subscribers.find((s) => s.email.toLowerCase() === clean);
    if (existing) {
      return { subscriber: existing, alreadyExists: true };
    }
    const sub: Subscriber = {
      id: this.seq.subscribers++,
      email: clean,
      created_at: new Date().toISOString(),
    };
    this.subscribers.unshift(sub);
    return { subscriber: sub, alreadyExists: false };
  }

  async deleteSubscriber(id: number): Promise<boolean> {
    const idx = this.subscribers.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.subscribers.splice(idx, 1);
    return true;
  }

  async getSettings(): Promise<SiteSettings> {
    return structuredClone(this.settings);
  }

  async updateSettings(settings: SiteSettings): Promise<SiteSettings> {
    this.settings = structuredClone(settings);
    return structuredClone(this.settings);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return {
      published_posts: this.posts.filter((p) => p.status === 'published').length,
      draft_posts: this.posts.filter((p) => p.status === 'draft').length,
      total_programs: this.programs.length,
      total_resources: this.resources.length,
      new_inquiries: this.inquiries.filter((i) => i.status === 'new').length,
      total_inquiries: this.inquiries.length,
      total_subscribers: this.subscribers.length,
      total_users: this.users.length,
    };
  }
}

class MySQLStore implements DataStore {
  mode: 'mysql' = 'mysql';
  private pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        email VARCHAR(190) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'author') NOT NULL DEFAULT 'author',
        title VARCHAR(190) NOT NULL DEFAULT '',
        bio TEXT NOT NULL,
        avatar_url VARCHAR(500) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(150) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        excerpt TEXT NOT NULL,
        content LONGTEXT NOT NULL,
        cover_image VARCHAR(500) NOT NULL DEFAULT '',
        category_id INT NULL,
        author_id INT NOT NULL,
        tags VARCHAR(500) NOT NULL DEFAULT '',
        reading_time INT NOT NULL DEFAULT 1,
        featured TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
        published_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_posts_status_pub (status, published_at),
        CONSTRAINT fk_posts_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS programs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        level ENUM('undergraduate', 'postgraduate', 'short_course') NOT NULL,
        faculty VARCHAR(190) NOT NULL DEFAULT '',
        duration VARCHAR(120) NOT NULL DEFAULT '',
        study_mode VARCHAR(160) NOT NULL DEFAULT '',
        entry_requirements TEXT NOT NULL,
        summary TEXT NOT NULL,
        highlights TEXT NOT NULL,
        intake VARCHAR(120) NOT NULL DEFAULT '',
        featured TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(120) NOT NULL,
        summary TEXT NOT NULL,
        file_url VARCHAR(500) NOT NULL DEFAULT '',
        youtube_url VARCHAR(500) NOT NULL DEFAULT '',
        publication_year VARCHAR(60) NOT NULL DEFAULT '2026',
        file_size VARCHAR(80) NOT NULL DEFAULT '1.0 MB PDF',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [ytColRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resources' AND COLUMN_NAME = 'youtube_url'`
    );
    if (Number(ytColRows[0]?.cnt || 0) === 0) {
      await this.pool.query(
        "ALTER TABLE resources ADD COLUMN youtube_url VARCHAR(500) DEFAULT '' AFTER file_url"
      );
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        email VARCHAR(190) NOT NULL,
        phone VARCHAR(80) NOT NULL DEFAULT '',
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        program_of_interest VARCHAR(255) NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        status ENUM('new', 'in_progress', 'resolved') NOT NULL DEFAULT 'new',
        admin_notes TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.seedIfEmpty();
  }

  private async seedIfEmpty(): Promise<void> {
    const [userRows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM users');
    if (Number(userRows[0]?.cnt || 0) === 0) {
      const adminCreds = getSeedAdminCredentials();
      const adminHash = await hashPassword(adminCreds.password);
      const editorHash = await hashPassword('Author@1234');

      await this.pool.query(
        'INSERT INTO users (name, email, password_hash, role, title, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          'Prof. Hastings Chikwanda',
          adminCreds.email,
          adminHash,
          'super_admin',
          'Principal & Senior Policy Fellow',
          'Development economist and Principal of GIPT specializing in public financial management, sovereign debt oversight, and regional higher education strategy.',
          '',
        ]
      );

      await this.pool.query(
        'INSERT INTO users (name, email, password_hash, role, title, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          'Dr. Grace Nkhoma',
          'editor@gipt.edu.mw',
          editorHash,
          'author',
          'Deputy Principal, Academic Affairs & Research',
          'Higher education strategist and governance researcher overseeing curriculum innovation, blended executive pedagogy, and academic quality assurance.',
          '',
        ]
      );
    }

    const [catRows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM categories');
    if (Number(catRows[0]?.cnt || 0) === 0) {
      for (const c of INITIAL_CATEGORIES) {
        await this.pool.query(
          'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
          [c.name, c.slug, c.description]
        );
      }
    }

    const [progRows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM programs');
    if (Number(progRows[0]?.cnt || 0) === 0) {
      for (const p of INITIAL_PROGRAMS) {
        await this.pool.query(
          `INSERT INTO programs (title, slug, level, faculty, duration, study_mode, entry_requirements, summary, highlights, intake, featured)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.title,
            p.slug,
            p.level,
            p.faculty,
            p.duration,
            p.study_mode,
            p.entry_requirements,
            p.summary,
            p.highlights,
            p.intake,
            p.featured ? 1 : 0,
          ]
        );
      }
    }

    const [resRows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM resources');
    if (Number(resRows[0]?.cnt || 0) === 0) {
      for (const r of INITIAL_RESOURCES) {
        await this.pool.query(
          `INSERT INTO resources (title, category, summary, file_url, youtube_url, publication_year, file_size)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [r.title, r.category, r.summary, r.file_url, r.youtube_url || '', r.publication_year, r.file_size]
        );
      }
    }

    const [postRows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM posts');
    if (Number(postRows[0]?.cnt || 0) === 0) {
      const cats = await this.listCategories();
      const users = await this.listUsers();
      for (const p of INITIAL_POSTS) {
        const cat = cats.find((c) => c.slug === p.category_slug);
        const author = users.find((u) => u.email === p.author_email) || users[0];
        if (!author) continue;
        await this.pool.query(
          `INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, author_id, tags, reading_time, featured, status, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.title,
            p.slug,
            p.excerpt,
            p.content,
            p.cover_image,
            cat ? cat.id : null,
            author.id,
            p.tags,
            calculateReadingTime(p.content),
            p.featured ? 1 : 0,
            p.status,
            new Date(p.published_at),
          ]
        );
      }
    }

    const [inqRows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM inquiries');
    if (Number(inqRows[0]?.cnt || 0) === 0) {
      for (const inq of INITIAL_INQUIRIES) {
        await this.pool.query(
          `INSERT INTO inquiries (name, email, phone, category, program_of_interest, message, status, admin_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inq.name,
            inq.email,
            inq.phone,
            inq.category,
            inq.program_of_interest,
            inq.message,
            inq.status,
            inq.admin_notes,
          ]
        );
      }
    }

    const [subRows] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM subscribers');
    if (Number(subRows[0]?.cnt || 0) === 0) {
      for (const sub of INITIAL_SUBSCRIBERS) {
        await this.pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [sub.email]);
      }
    }

    const [setRows] = await this.pool.query<RowDataPacket[]>(
      'SELECT setting_value FROM site_settings WHERE setting_key = ?',
      ['main']
    );
    if (setRows.length === 0) {
      await this.pool.query(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)',
        ['main', JSON.stringify(INITIAL_SITE_SETTINGS)]
      );
    }
  }

  private mapPost(row: RowDataPacket): Post {
    return {
      id: Number(row.id),
      title: String(row.title),
      slug: String(row.slug),
      excerpt: String(row.excerpt),
      content: String(row.content),
      cover_image: String(row.cover_image || ''),
      category_id: row.category_id ? Number(row.category_id) : null,
      category_name: row.category_name ? String(row.category_name) : 'Uncategorized',
      category_slug: row.category_slug ? String(row.category_slug) : 'uncategorized',
      author_id: Number(row.author_id),
      author_name: row.author_name ? String(row.author_name) : 'GIPT Editorial Desk',
      author_title: row.author_title ? String(row.author_title) : '',
      author_bio: row.author_bio ? String(row.author_bio) : '',
      tags: String(row.tags || ''),
      reading_time: Number(row.reading_time || 1),
      featured: Boolean(row.featured),
      status: row.status as PostStatus,
      published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  private mapProgram(row: RowDataPacket): Program {
    return {
      id: Number(row.id),
      title: String(row.title),
      slug: String(row.slug),
      level: row.level as ProgramLevel,
      faculty: String(row.faculty || ''),
      duration: String(row.duration || ''),
      study_mode: String(row.study_mode || ''),
      entry_requirements: String(row.entry_requirements || ''),
      summary: String(row.summary || ''),
      highlights: String(row.highlights || ''),
      intake: String(row.intake || ''),
      featured: Boolean(row.featured),
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email.trim()]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      password_hash: String(r.password_hash),
      role: r.role as UserRole,
      title: String(r.title || ''),
      bio: String(r.bio || ''),
      avatar_url: String(r.avatar_url || ''),
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  async getUserById(id: number): Promise<StoredUser | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      password_hash: String(r.password_hash),
      role: r.role as UserRole,
      title: String(r.title || ''),
      bio: String(r.bio || ''),
      avatar_url: String(r.avatar_url || ''),
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  async listUsers(): Promise<User[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT id, name, email, role, title, bio, avatar_url, created_at FROM users ORDER BY id ASC'
    );
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      role: r.role as UserRole,
      title: String(r.title || ''),
      bio: String(r.bio || ''),
      avatar_url: String(r.avatar_url || ''),
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  async createUser(data: {
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    title: string;
    bio: string;
    avatar_url?: string;
  }): Promise<User> {
    const [res] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO users (name, email, password_hash, role, title, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.name, data.email.trim().toLowerCase(), data.password_hash, data.role, data.title, data.bio, data.avatar_url || '']
    );
    const created = await this.getUserById(res.insertId);
    return stripPassword(created!);
  }

  async updateUser(
    id: number,
    data: Partial<{
      name: string;
      email: string;
      password_hash: string;
      role: UserRole;
      title: string;
      bio: string;
      avatar_url: string;
    }>
  ): Promise<User | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email.trim().toLowerCase()); }
    if (data.password_hash !== undefined) { fields.push('password_hash = ?'); values.push(data.password_hash); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.bio !== undefined) { fields.push('bio = ?'); values.push(data.bio); }
    if (data.avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(data.avatar_url); }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const updated = await this.getUserById(id);
    return updated ? stripPassword(updated) : null;
  }

  async deleteUser(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async listCategories(): Promise<Category[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM categories ORDER BY name ASC');
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description || ''),
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  async createCategory(data: { name: string; slug: string; description: string }): Promise<Category> {
    const finalSlug = data.slug || slugify(data.name);
    const [res] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [data.name, finalSlug, data.description]
    );
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM categories WHERE id = ?', [res.insertId]);
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description || ''),
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  async updateCategory(
    id: number,
    data: { name: string; slug: string; description: string }
  ): Promise<Category | null> {
    const finalSlug = data.slug || slugify(data.name);
    await this.pool.query('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?', [
      data.name,
      finalSlug,
      data.description,
      id,
    ]);
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM categories WHERE id = ?', [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description || ''),
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  async deleteCategory(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>('DELETE FROM categories WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async listPosts(options?: { status?: PostStatus | 'all'; authorId?: number }): Promise<Post[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (options?.status && options.status !== 'all') {
      where.push('p.status = ?');
      params.push(options.status);
    }
    if (options?.authorId !== undefined) {
      where.push('p.author_id = ?');
      params.push(options.authorId);
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              u.name AS author_name, u.title AS author_title, u.bio AS author_bio
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
       ${whereClause}
       ORDER BY COALESCE(p.published_at, p.created_at) DESC`,
      params
    );
    return rows.map((r) => this.mapPost(r));
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              u.name AS author_name, u.title AS author_title, u.bio AS author_bio
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.slug = ? LIMIT 1`,
      [slug]
    );
    return rows[0] ? this.mapPost(rows[0]) : null;
  }

  async getPostById(id: number): Promise<Post | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              u.name AS author_name, u.title AS author_title, u.bio AS author_bio
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ? this.mapPost(rows[0]) : null;
  }

  private async ensureUniquePostSlug(base: string, excludeId?: number): Promise<string> {
    let candidate = slugify(base) || `post-${Date.now()}`;
    let counter = 2;
    while (true) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        excludeId
          ? 'SELECT id FROM posts WHERE slug = ? AND id != ? LIMIT 1'
          : 'SELECT id FROM posts WHERE slug = ? LIMIT 1',
        excludeId ? [candidate, excludeId] : [candidate]
      );
      if (rows.length === 0) return candidate;
      candidate = `${slugify(base)}-${counter++}`;
    }
  }

  async createPost(data: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    cover_image: string;
    category_id: number | null;
    author_id: number;
    tags: string;
    reading_time: number;
    featured: boolean;
    status: PostStatus;
    published_at: string | null;
  }): Promise<Post> {
    const uniqueSlug = await this.ensureUniquePostSlug(data.slug || data.title);
    const pubAt = data.status === 'published' ? new Date(data.published_at || Date.now()) : null;
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, author_id, tags, reading_time, featured, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        uniqueSlug,
        data.excerpt,
        data.content,
        data.cover_image,
        data.category_id,
        data.author_id,
        data.tags,
        data.reading_time,
        data.featured ? 1 : 0,
        data.status,
        pubAt,
      ]
    );
    return (await this.getPostById(res.insertId))!;
  }

  async updatePost(
    id: number,
    data: Partial<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      cover_image: string;
      category_id: number | null;
      tags: string;
      reading_time: number;
      featured: boolean;
      status: PostStatus;
      published_at: string | null;
    }>
  ): Promise<Post | null> {
    const existing = await this.getPostById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.slug !== undefined && data.slug !== existing.slug) {
      const uniqueSlug = await this.ensureUniquePostSlug(data.slug, id);
      fields.push('slug = ?');
      values.push(uniqueSlug);
    }
    if (data.excerpt !== undefined) { fields.push('excerpt = ?'); values.push(data.excerpt); }
    if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
    if (data.cover_image !== undefined) { fields.push('cover_image = ?'); values.push(data.cover_image); }
    if (data.category_id !== undefined) { fields.push('category_id = ?'); values.push(data.category_id); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(data.tags); }
    if (data.reading_time !== undefined) { fields.push('reading_time = ?'); values.push(data.reading_time); }
    if (data.featured !== undefined) { fields.push('featured = ?'); values.push(data.featured ? 1 : 0); }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
      if (data.status === 'published' && !existing.published_at) {
        fields.push('published_at = ?');
        values.push(new Date(data.published_at || Date.now()));
      } else if (data.status === 'draft') {
        fields.push('published_at = ?');
        values.push(null);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE posts SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return this.getPostById(id);
  }

  async deletePost(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>('DELETE FROM posts WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async listPrograms(): Promise<Program[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM programs ORDER BY id ASC');
    return rows.map((r) => this.mapProgram(r));
  }

  async getProgramById(id: number): Promise<Program | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM programs WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? this.mapProgram(rows[0]) : null;
  }

  async createProgram(data: Omit<Program, 'id' | 'created_at'>): Promise<Program> {
    const finalSlug = `${slugify(data.slug || data.title)}-${Date.now().toString().slice(-4)}`;
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO programs (title, slug, level, faculty, duration, study_mode, entry_requirements, summary, highlights, intake, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        finalSlug,
        data.level,
        data.faculty,
        data.duration,
        data.study_mode,
        data.entry_requirements,
        data.summary,
        data.highlights,
        data.intake,
        data.featured ? 1 : 0,
      ]
    );
    return (await this.getProgramById(res.insertId))!;
  }

  async updateProgram(
    id: number,
    data: Partial<Omit<Program, 'id' | 'created_at'>>
  ): Promise<Program | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.level !== undefined) { fields.push('level = ?'); values.push(data.level); }
    if (data.faculty !== undefined) { fields.push('faculty = ?'); values.push(data.faculty); }
    if (data.duration !== undefined) { fields.push('duration = ?'); values.push(data.duration); }
    if (data.study_mode !== undefined) { fields.push('study_mode = ?'); values.push(data.study_mode); }
    if (data.entry_requirements !== undefined) { fields.push('entry_requirements = ?'); values.push(data.entry_requirements); }
    if (data.summary !== undefined) { fields.push('summary = ?'); values.push(data.summary); }
    if (data.highlights !== undefined) { fields.push('highlights = ?'); values.push(data.highlights); }
    if (data.intake !== undefined) { fields.push('intake = ?'); values.push(data.intake); }
    if (data.featured !== undefined) { fields.push('featured = ?'); values.push(data.featured ? 1 : 0); }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE programs SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return this.getProgramById(id);
  }

  async deleteProgram(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>('DELETE FROM programs WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async listResources(): Promise<Resource[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM resources ORDER BY id ASC');
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      category: String(r.category),
      summary: String(r.summary),
      file_url: String(r.file_url || ''),
      youtube_url: String(r.youtube_url || ''),
      publication_year: String(r.publication_year),
      file_size: String(r.file_size),
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  async getResourceById(id: number): Promise<Resource | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM resources WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      title: String(r.title),
      category: String(r.category),
      summary: String(r.summary),
      file_url: String(r.file_url || ''),
      youtube_url: String(r.youtube_url || ''),
      publication_year: String(r.publication_year),
      file_size: String(r.file_size),
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  async createResource(data: Omit<Resource, 'id' | 'created_at'>): Promise<Resource> {
    const youtubeUrl = data.youtube_url || '';
    const fileUrl = data.file_url || '';
    const [res] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO resources (title, category, summary, file_url, youtube_url, publication_year, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.title, data.category, data.summary, fileUrl, youtubeUrl, data.publication_year, data.file_size]
    );
    if (!fileUrl && !youtubeUrl) {
      await this.pool.query('UPDATE resources SET file_url = ? WHERE id = ?', [
        `/api/resources/${res.insertId}/download`,
        res.insertId,
      ]);
    }
    return (await this.getResourceById(res.insertId))!;
  }

  async updateResource(
    id: number,
    data: Partial<Omit<Resource, 'id' | 'created_at'>>
  ): Promise<Resource | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.summary !== undefined) { fields.push('summary = ?'); values.push(data.summary); }
    if (data.file_url !== undefined) { fields.push('file_url = ?'); values.push(data.file_url); }
    if (data.youtube_url !== undefined) { fields.push('youtube_url = ?'); values.push(data.youtube_url); }
    if (data.publication_year !== undefined) { fields.push('publication_year = ?'); values.push(data.publication_year); }
    if (data.file_size !== undefined) { fields.push('file_size = ?'); values.push(data.file_size); }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return this.getResourceById(id);
  }

  async deleteResource(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>('DELETE FROM resources WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async listInquiries(): Promise<Inquiry[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM inquiries ORDER BY created_at DESC');
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      phone: String(r.phone || ''),
      category: String(r.category || 'General'),
      program_of_interest: String(r.program_of_interest || ''),
      message: String(r.message || ''),
      status: r.status as InquiryStatus,
      admin_notes: String(r.admin_notes || ''),
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  async createInquiry(
    data: Omit<Inquiry, 'id' | 'status' | 'admin_notes' | 'created_at'>
  ): Promise<Inquiry> {
    const [res] = await this.pool.query<ResultSetHeader>(
      `INSERT INTO inquiries (name, email, phone, category, program_of_interest, message, status, admin_notes)
       VALUES (?, ?, ?, ?, ?, ?, 'new', '')`,
      [data.name, data.email, data.phone, data.category, data.program_of_interest, data.message]
    );
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM inquiries WHERE id = ?', [res.insertId]);
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      phone: String(r.phone || ''),
      category: String(r.category || 'General'),
      program_of_interest: String(r.program_of_interest || ''),
      message: String(r.message || ''),
      status: r.status as InquiryStatus,
      admin_notes: String(r.admin_notes || ''),
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  async updateInquiry(
    id: number,
    data: { status?: InquiryStatus; admin_notes?: string }
  ): Promise<Inquiry | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.admin_notes !== undefined) { fields.push('admin_notes = ?'); values.push(data.admin_notes); }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE inquiries SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM inquiries WHERE id = ?', [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      phone: String(r.phone || ''),
      category: String(r.category || 'General'),
      program_of_interest: String(r.program_of_interest || ''),
      message: String(r.message || ''),
      status: r.status as InquiryStatus,
      admin_notes: String(r.admin_notes || ''),
      created_at: new Date(r.created_at).toISOString(),
    };
  }

  async deleteInquiry(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>('DELETE FROM inquiries WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async listSubscribers(): Promise<Subscriber[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM subscribers ORDER BY created_at DESC');
    return rows.map((r) => ({
      id: Number(r.id),
      email: String(r.email),
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  async addSubscriber(email: string): Promise<{ subscriber: Subscriber; alreadyExists: boolean }> {
    const clean = email.trim().toLowerCase();
    const [existing] = await this.pool.query<RowDataPacket[]>(
      'SELECT * FROM subscribers WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [clean]
    );
    if (existing[0]) {
      return {
        subscriber: {
          id: Number(existing[0].id),
          email: String(existing[0].email),
          created_at: new Date(existing[0].created_at).toISOString(),
        },
        alreadyExists: true,
      };
    }
    const [res] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO subscribers (email) VALUES (?)',
      [clean]
    );
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT * FROM subscribers WHERE id = ?', [res.insertId]);
    return {
      subscriber: {
        id: Number(rows[0].id),
        email: String(rows[0].email),
        created_at: new Date(rows[0].created_at).toISOString(),
      },
      alreadyExists: false,
    };
  }

  async deleteSubscriber(id: number): Promise<boolean> {
    const [res] = await this.pool.query<ResultSetHeader>('DELETE FROM subscribers WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async getSettings(): Promise<SiteSettings> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT setting_value FROM site_settings WHERE setting_key = ?',
      ['main']
    );
    if (!rows[0]) return structuredClone(INITIAL_SITE_SETTINGS);
    try {
      const parsed = JSON.parse(String(rows[0].setting_value)) as Partial<SiteSettings>;
      return { ...structuredClone(INITIAL_SITE_SETTINGS), ...parsed };
    } catch {
      return structuredClone(INITIAL_SITE_SETTINGS);
    }
  }

  async updateSettings(settings: SiteSettings): Promise<SiteSettings> {
    await this.pool.query(
      `INSERT INTO site_settings (setting_key, setting_value)
       VALUES ('main', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [JSON.stringify(settings)]
    );
    return this.getSettings();
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [[postStats]] = await this.pool.query<RowDataPacket[]>(
      `SELECT
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_posts,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_posts
       FROM posts`
    );
    const [[progStats]] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM programs');
    const [[resStats]] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM resources');
    const [[inqStats]] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_cnt FROM inquiries`
    );
    const [[subStats]] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM subscribers');
    const [[usrStats]] = await this.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM users');

    return {
      published_posts: Number(postStats?.published_posts || 0),
      draft_posts: Number(postStats?.draft_posts || 0),
      total_programs: Number(progStats?.cnt || 0),
      total_resources: Number(resStats?.cnt || 0),
      new_inquiries: Number(inqStats?.new_cnt || 0),
      total_inquiries: Number(inqStats?.total || 0),
      total_subscribers: Number(subStats?.cnt || 0),
      total_users: Number(usrStats?.cnt || 0),
    };
  }
}

export async function createDataStore(): Promise<DataStore> {
  if (process.env.DB_HOST && process.env.DB_HOST.trim() !== '') {
    try {
      const mysqlStore = new MySQLStore();
      await mysqlStore.init();
      console.log('[GIPT] Connected to MySQL database and verified schema.');
      return mysqlStore;
    } catch (err) {
      console.error('[GIPT] MySQL connection failed, falling back to in-memory store:', err);
    }
  }
  const memoryStore = new MemoryStore();
  await memoryStore.init();
  console.log('[GIPT] Running with pre-populated in-memory store (DB_HOST unset).');
  return memoryStore;
}
