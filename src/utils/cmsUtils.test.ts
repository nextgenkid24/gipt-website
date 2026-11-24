import test from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  calculateReadingTime,
  parseTags,
  sanitizeUrl,
  filterPrograms,
  filterPosts,
  parseMarkdownBlocks,
  parseInlineMarkdown,
  isValidEmail,
} from './cmsUtils';
import type { Post, Program } from '../types';

test('slugify generates clean SEO slugs', () => {
  assert.equal(slugify('Advancing Public Sector Finance in Southern Africa!'), 'advancing-public-sector-finance-in-southern-africa');
  assert.equal(slugify('  Executive Leadership & Policy (2026)  '), 'executive-leadership-policy-2026');
  assert.equal(slugify('Café & Résumé Workshop'), 'cafe-resume-workshop');
});

test('calculateReadingTime estimates minutes accurately', () => {
  assert.equal(calculateReadingTime('Short note'), 1);
  const longText = Array.from({ length: 450 }, () => 'policy').join(' ');
  assert.equal(calculateReadingTime(longText), 3);
});

test('parseTags trims, removes empties, and deduplicates case-insensitively', () => {
  assert.deepEqual(parseTags('Governance, policy, governance, , Research '), ['Governance', 'policy', 'Research']);
});

test('sanitizeUrl allows safe paths and protocols while blocking XSS schemes', () => {
  assert.equal(sanitizeUrl('/src/assets/images/hero.jpg'), '/src/assets/images/hero.jpg');
  assert.equal(sanitizeUrl('https://gipt.edu.mw/prospectus'), 'https://gipt.edu.mw/prospectus');
  assert.equal(sanitizeUrl('mailto:admissions@gipt.edu.mw'), 'mailto:admissions@gipt.edu.mw');
  assert.equal(sanitizeUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(sanitizeUrl('//evil.example/script.js'), '');
});

test('filterPrograms filters by track, study mode, and keyword', () => {
  const sample: Program[] = [
    {
      id: 1,
      title: 'BSc in Business Administration',
      slug: 'bsc-business-admin',
      level: 'undergraduate',
      faculty: 'School of Commerce',
      duration: '4 Years',
      study_mode: 'Full-time, Blended',
      entry_requirements: 'MSCE with 6 credits',
      summary: 'Core management training',
      highlights: '',
      intake: 'September',
      featured: true,
      created_at: '2026-01-01',
    },
    {
      id: 2,
      title: 'GIPT Research Mentorship Programme (Flagship)',
      slug: 'gipt-research-mentorship-flagship',
      level: 'short_course',
      faculty: 'Flagship · Research Mentorship Programme',
      duration: 'Structured Cohort',
      study_mode: 'Online & Blended Mentorship',
      entry_requirements: 'Scholars and students',
      summary: 'Tailored research training, pairing scholars with senior mentors in empirical methods',
      highlights: '',
      intake: 'Rolling',
      featured: true,
      created_at: '2026-01-01',
    },
    {
      id: 3,
      title: 'Quantitative Data Analysis and Visualisation Using Stata',
      slug: 'quantitative-data-analysis-stata',
      level: 'short_course',
      faculty: 'Research Methods Short Courses',
      duration: '5 Days · 8:00 am – 4:00 pm',
      study_mode: 'Physical (Blantyre)',
      entry_requirements: 'Fee: MK550,000',
      summary: 'Hands-on Stata analysis workshop in Blantyre',
      highlights: '',
      intake: '21 – 25 September · Physical (Blantyre)',
      featured: true,
      created_at: '2026-01-01',
    },
    {
      id: 4,
      title: 'Applied Data Science & Machine Learning',
      slug: 'applied-data-science-ml',
      level: 'short_course',
      faculty: '4th Industrial Revolution (4IR) Skills Academy',
      duration: '6 Weeks',
      study_mode: 'Online, Blended',
      entry_requirements: 'Foundational numeracy',
      summary: '4IR machine learning and analytics',
      highlights: '',
      intake: 'Quarterly',
      featured: true,
      created_at: '2026-01-01',
    },
    {
      id: 5,
      title: 'Free Information Session: Emerging 4IR Technologies & AI in Research',
      slug: 'free-info-session-4ir-ai-research',
      level: 'short_course',
      faculty: 'Free Information Sessions (Research & Technology)',
      duration: '90 Minutes',
      study_mode: 'Online (Free Open Session)',
      entry_requirements: 'Fee: FREE',
      summary: 'Complimentary open webinar on research and technology',
      highlights: '',
      intake: 'Monthly',
      featured: false,
      created_at: '2026-01-01',
    },
  ];

  assert.equal(filterPrograms(sample, { level: 'active' }).length, 4);
  assert.equal(filterPrograms(sample, { level: 'mentorship' }).length, 1);
  assert.equal(filterPrograms(sample, { level: 'mentorship' })[0].slug, 'gipt-research-mentorship-flagship');
  assert.equal(filterPrograms(sample, { level: 'research_methods' }).length, 1);
  assert.equal(filterPrograms(sample, { level: 'research_methods' })[0].slug, 'quantitative-data-analysis-stata');
  assert.equal(filterPrograms(sample, { level: '4ir' }).length, 1);
  assert.equal(filterPrograms(sample, { level: '4ir' })[0].slug, 'applied-data-science-ml');
  assert.equal(filterPrograms(sample, { level: 'free_sessions' }).length, 1);
  assert.equal(filterPrograms(sample, { level: 'free_sessions' })[0].slug, 'free-info-session-4ir-ai-research');
  assert.equal(filterPrograms(sample, { level: 'degrees' }).length, 1);
  assert.equal(filterPrograms(sample, { studyMode: 'blantyre' }).length, 1);
  assert.equal(filterPrograms(sample, { query: 'stata' })[0].slug, 'quantitative-data-analysis-stata');
});

test('filterPosts filters by category, tag, and search term', () => {
  const posts: Post[] = [
    {
      id: 1,
      title: 'Regional Fiscal Resilience',
      slug: 'regional-fiscal-resilience',
      excerpt: 'How fiscal buffers strengthen growth',
      content: 'Macroeconomic evidence from Southern Africa',
      cover_image: '',
      category_id: 1,
      category_slug: 'policy-briefs',
      author_id: 1,
      author_name: 'Dr. Banda',
      tags: 'Economics, Governance',
      reading_time: 5,
      featured: true,
      status: 'published',
      published_at: '2026-05-01',
      created_at: '2026-05-01',
      updated_at: '2026-05-01',
    },
  ];

  assert.equal(filterPosts(posts, { categorySlug: 'policy-briefs' }).length, 1);
  assert.equal(filterPosts(posts, { tag: 'economics' }).length, 1);
  assert.equal(filterPosts(posts, { query: 'macroeconomic' }).length, 1);
  assert.equal(filterPosts(posts, { categorySlug: 'events' }).length, 0);
});

test('parseMarkdownBlocks and parseInlineMarkdown safely parse headings, lists, blockquotes, and links', () => {
  const md = `## Executive Summary\n\nPolicy **reform** matters. Visit [GIPT](https://gipt.edu.mw) or [Bad](javascript:alert(1)).\n\n> Strong institutions build resilient economies.\n\n- Pillar One\n- Pillar Two`;
  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0].type, 'h2');
  assert.equal(blocks[1].type, 'p');
  assert.equal(blocks[2].type, 'blockquote');
  assert.equal(blocks[3].type, 'ul');

  const inline = parseInlineMarkdown(blocks[1].type === 'p' ? blocks[1].text : '');
  const linkTokens = inline.filter((t) => t.type === 'link');
  assert.equal(linkTokens.length, 1);
  assert.equal(linkTokens[0].type === 'link' && linkTokens[0].href, 'https://gipt.edu.mw');
});

test('isValidEmail validates common email formats', () => {
  assert.equal(isValidEmail('student@gipt.edu.mw'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});
