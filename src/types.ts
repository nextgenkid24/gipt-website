export type UserRole = 'super_admin' | 'author';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  bio: string;
  avatar_url?: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}

export type PostStatus = 'draft' | 'published';

export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  category_id: number | null;
  category_name?: string;
  category_slug?: string;
  author_id: number;
  author_name?: string;
  author_title?: string;
  author_bio?: string;
  tags: string; // comma-separated
  reading_time: number;
  featured: boolean;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProgramLevel = 'undergraduate' | 'postgraduate' | 'short_course';

export interface Program {
  id: number;
  title: string;
  slug: string;
  level: ProgramLevel;
  faculty: string;
  duration: string;
  study_mode: string; // e.g., "Full-time, Part-time, Blended"
  entry_requirements: string;
  summary: string;
  highlights: string; // newline-separated highlights
  intake: string;
  featured: boolean;
  created_at: string;
}

export interface Resource {
  id: number;
  title: string;
  category: string; // Prospectus, Academic Calendar, Policy Brief, Research Paper, Brochure
  summary: string;
  file_url: string;
  publication_year: string;
  file_size: string;
  created_at: string;
}

export type InquiryStatus = 'new' | 'in_progress' | 'resolved';

export interface Inquiry {
  id: number;
  name: string;
  email: string;
  phone: string;
  category: string; // General, Undergraduate, Postgraduate, Corporate Training
  program_of_interest: string;
  message: string;
  status: InquiryStatus;
  admin_notes: string;
  created_at: string;
}

export interface Subscriber {
  id: number;
  email: string;
  created_at: string;
}

export interface HeroSlide {
  id: string;
  kicker: string;
  headline: string;
  subheadline: string;
  image_url: string;
  primary_cta_label: string;
  primary_cta_link: string;
  secondary_cta_label: string;
  secondary_cta_link: string;
}

export interface ImpactStat {
  label: string;
  value: string;
  context: string;
}

export interface CoreValue {
  title: string;
  description: string;
}

export interface Leader {
  name: string;
  role: string;
  department: string;
  bio: string;
}

export interface SiteSettings {
  institute_name: string;
  institute_short_name: string;
  tagline: string;
  logo_url: string;
  announcement_enabled: boolean;
  announcement_text: string;
  announcement_link_label: string;
  announcement_link_url: string;
  hero_slides: HeroSlide[];
  impact_stats: ImpactStat[];
  about_overview: string;
  about_mandate: string;
  mission: string;
  vision: string;
  core_values: CoreValue[];
  leadership: Leader[];
  contact_address: string;
  contact_phone_primary: string;
  contact_phone_secondary: string;
  contact_email_admissions: string;
  contact_email_general: string;
  office_hours: string;
  social_linkedin: string;
  social_twitter: string;
  social_facebook: string;
  social_youtube: string;
  seo_default_title: string;
  seo_default_description: string;
}

export interface DashboardStats {
  published_posts: number;
  draft_posts: number;
  total_programs: number;
  total_resources: number;
  new_inquiries: number;
  total_inquiries: number;
  total_subscribers: number;
  total_users: number;
}
