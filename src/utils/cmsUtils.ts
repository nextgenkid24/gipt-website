import type { Post, Program, ProgramLevel, Resource } from '../types';

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function calculateReadingTime(markdownText: string): number {
  const plain = markdownText
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-]+/g, ' ')
    .trim();
  if (!plain) return 1;
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

export function parseTags(tagsString: string): string[] {
  if (!tagsString) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tagsString.split(',')) {
    const clean = raw.trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return trimmed;
    }
    return '';
  } catch {
    return '';
  }
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatProgramLevel(level: ProgramLevel): string {
  switch (level) {
    case 'undergraduate':
      return 'Undergraduate';
    case 'postgraduate':
      return 'Postgraduate';
    case 'short_course':
      return 'Executive & Short Courses';
  }
}

export function isFreeSessionProgram(program: Program): boolean {
  if (program.level !== 'short_course') return false;
  const trackText = `${program.faculty} ${program.title}`.toLowerCase();
  return (
    trackText.includes('free information session') ||
    trackText.includes('free session') ||
    trackText.includes('open information session')
  );
}

export function isResearchMentorshipProgram(program: Program): boolean {
  if (program.level !== 'short_course') return false;
  if (isFreeSessionProgram(program)) return false;
  const trackText = `${program.faculty} ${program.title}`.toLowerCase();
  return trackText.includes('mentorship');
}

export function isResearchMethodsCourse(program: Program): boolean {
  if (program.level !== 'short_course') return false;
  if (isFreeSessionProgram(program) || isResearchMentorshipProgram(program)) return false;
  const facultyLower = program.faculty.toLowerCase();
  return facultyLower.includes('research methods');
}

export function is4IRShortCourse(program: Program): boolean {
  if (program.level !== 'short_course') return false;
  if (
    isFreeSessionProgram(program) ||
    isResearchMentorshipProgram(program) ||
    isResearchMethodsCourse(program)
  ) {
    return false;
  }
  const trackText = `${program.faculty} ${program.title} ${program.summary}`;
  return /\b(4ir|industrial revolution|industry 4\.0|ai|artificial intelligence|machine learning|data science|cloud|cybersecurity|iot|automation|digital)\b/i.test(
    trackText
  );
}

export function filterPrograms(
  programs: Program[],
  options: { query?: string; level?: string; studyMode?: string }
): Program[] {
  const q = (options.query || '').trim().toLowerCase();
  const level = options.level || 'all';
  const mode = (options.studyMode || 'all').toLowerCase();

  return programs.filter((p) => {
    if (level === 'active') {
      if (p.level !== 'short_course') return false;
    } else if (level === 'mentorship') {
      if (!isResearchMentorshipProgram(p)) return false;
    } else if (level === 'research_methods') {
      if (!isResearchMethodsCourse(p)) return false;
    } else if (level === '4ir') {
      if (!is4IRShortCourse(p)) return false;
    } else if (level === 'free_sessions') {
      if (!isFreeSessionProgram(p)) return false;
    } else if (level === 'degrees') {
      if (p.level !== 'undergraduate' && p.level !== 'postgraduate') return false;
    } else if (level !== 'all' && p.level !== level) {
      return false;
    }
    if (mode !== 'all' && !p.study_mode.toLowerCase().includes(mode)) return false;
    if (q) {
      const hay = `${p.title} ${p.faculty} ${p.summary} ${p.entry_requirements} ${p.study_mode} ${p.intake}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterPosts(
  posts: Post[],
  options: { query?: string; categorySlug?: string; tag?: string }
): Post[] {
  const q = (options.query || '').trim().toLowerCase();
  const cat = (options.categorySlug || 'all').toLowerCase();
  const tag = (options.tag || '').trim().toLowerCase();

  return posts.filter((post) => {
    if (cat !== 'all' && (post.category_slug || '').toLowerCase() !== cat) {
      return false;
    }
    if (tag) {
      const postTags = parseTags(post.tags).map((t) => t.toLowerCase());
      if (!postTags.includes(tag)) return false;
    }
    if (q) {
      const hay = `${post.title} ${post.excerpt} ${post.content} ${post.tags} ${post.author_name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const RESOURCE_HUB_CATEGORIES = [
  'Session Recordings',
  'Presentations',
  'Datasets',
  'Guides & Toolkits',
] as const;

const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function extractYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(host)) {
    return null;
  }

  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;
  } else {
    const vParam = parsed.searchParams.get('v');
    if (vParam) {
      candidate = vParam;
    } else {
      const pathMatch = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/.exec(
        parsed.pathname
      );
      if (pathMatch) {
        candidate = pathMatch[1];
      }
    }
  }

  if (!candidate || !/^[A-Za-z0-9_-]{11}$/.test(candidate)) {
    return null;
  }
  return candidate;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
}

export function getResourceYouTubeId(
  resource: Pick<Resource, 'youtube_url' | 'file_url'>
): string | null {
  return extractYouTubeId(resource.youtube_url) || extractYouTubeId(resource.file_url);
}

export function hasDownloadableFile(resource: Pick<Resource, 'file_url'>): boolean {
  const safe = sanitizeUrl(resource.file_url);
  if (!safe) return false;
  return extractYouTubeId(safe) === null;
}

export function getResourceFileLabel(
  resource: Pick<Resource, 'file_url' | 'file_size'>
): string {
  const sizeText = (resource.file_size || '').trim();
  if (sizeText) return sizeText;
  const lowerUrl = (resource.file_url || '').toLowerCase();
  if (lowerUrl.endsWith('.pptx')) return 'PPTX Slides';
  if (lowerUrl.endsWith('.xlsx')) return 'XLSX Dataset';
  if (lowerUrl.endsWith('.csv')) return 'CSV Dataset';
  if (lowerUrl.endsWith('.zip')) return 'ZIP Toolkit';
  if (lowerUrl.endsWith('.pdf')) return 'PDF Handout';
  if (/\.(jpg|jpeg|png|webp)$/.test(lowerUrl)) return 'Image Poster';
  return 'Resource File';
}

const LEGACY_GUIDE_CATEGORIES = new Set([
  'prospectus',
  'academic calendar',
  'academic guide',
  'policy brief',
  'research paper',
  'brochure',
]);

export function filterResources(
  resources: Resource[],
  options: { query?: string; category?: string }
): Resource[] {
  const q = (options.query || '').trim().toLowerCase();
  const cat = (options.category || 'all').toLowerCase();

  return resources.filter((r) => {
    if (cat !== 'all') {
      const rCat = r.category.toLowerCase();
      if (cat === 'guides & toolkits') {
        if (rCat !== cat && !LEGACY_GUIDE_CATEGORIES.has(rCat)) return false;
      } else if (cat === 'session recordings') {
        if (rCat !== cat && !getResourceYouTubeId(r)) return false;
      } else if (rCat !== cat) {
        return false;
      }
    }
    if (q) {
      const hay = `${r.title} ${r.category} ${r.summary} ${r.publication_year} ${r.file_size}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type MarkdownBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string };

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h2', text: line.slice(2).trim() });
      i++;
      continue;
    }

    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join(' ') });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('> ') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'p', text: paraLines.join(' ') });
    }
  }

  return blocks;
}

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'link'; text: string; href: string };

export function parseInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ type: 'bold', text: raw.slice(2, -2) });
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push({ type: 'italic', text: raw.slice(1, -1) });
    } else if (raw.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw);
      if (linkMatch) {
        const safeHref = sanitizeUrl(linkMatch[2]);
        if (safeHref) {
          tokens.push({ type: 'link', text: linkMatch[1], href: safeHref });
        } else {
          tokens.push({ type: 'text', text: linkMatch[1] });
        }
      }
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return tokens;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
