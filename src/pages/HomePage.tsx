import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Play,
  PlayCircle,
  Presentation,
  Search,
} from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { CountUpStat, ScrollReveal } from '../components/ScrollReveal';
import { VideoModal } from '../components/VideoModal';
import { updateDocumentMeta, useSite } from '../context/SiteContext';
import { apiFetch } from '../lib/api';
import type { Post, Program, Resource } from '../types';
import {
  filterPrograms,
  filterResources,
  formatDate,
  getResourceFileLabel,
  getResourceYouTubeId,
  getYouTubeThumbnailUrl,
  hasDownloadableFile,
  isValidEmail,
  RESOURCE_HUB_CATEGORIES,
  sanitizeUrl,
} from '../utils/cmsUtils';

function ResourceVideoThumbnail({
  videoId,
  title,
  dateBadge,
  onPlay,
}: {
  videoId: string;
  title: string;
  dateBadge: string;
  onPlay: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Watch recorded session: ${title}`}
      className="relative block w-full aspect-video overflow-hidden bg-[#0D1926] text-left focus-visible:outline-2 focus-visible:outline-[#00B1CB]"
    >
      {!thumbFailed ? (
        <img
          src={getYouTubeThumbnailUrl(videoId)}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setThumbFailed(true)}
          className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center p-5 bg-gradient-to-br from-[#182B3E] via-[#132232] to-[#0B1520]"
          aria-hidden="true"
        >
          <PlayCircle className="w-9 h-9 text-[#00B1CB]/70 mb-2" />
          <span className="text-[11px] font-medium text-slate-300 text-center line-clamp-2 max-w-[85%]">
            {title}
          </span>
        </div>
      )}

      {/* Measured contrast scrim */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#0B1520]/85 via-[#0B1520]/25 to-transparent transition-opacity duration-300 group-hover:from-[#0B1520]/75"
        aria-hidden="true"
      />

      {/* Centered Play Button with subtle hover pulse ring & lift */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="relative inline-flex items-center justify-center">
          <span
            className="gipt-play-ring absolute inset-0 rounded-full bg-[#00B1CB]/50"
            aria-hidden="true"
          />
          <span className="relative w-14 h-14 rounded-full bg-[#F26422] group-hover:bg-[#D95316] text-white shadow-lg flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:-translate-y-0.5">
            <Play className="w-6 h-6 fill-current ml-0.5" aria-hidden="true" />
          </span>
        </span>
      </div>

      {/* Bottom duration / date overlay */}
      {dateBadge && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-white/95">
          <span className="px-2 py-0.5 rounded bg-[#0B1520]/80 backdrop-blur-xs border border-white/15">
            {dateBadge}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#008398]/90 text-white font-sans font-semibold tracking-wide">
            Video Session
          </span>
        </div>
      )}
    </button>
  );
}

function getCategoryIcon(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes('recording') || lower.includes('video')) return PlayCircle;
  if (lower.includes('presentation') || lower.includes('slide')) return Presentation;
  if (lower.includes('dataset') || lower.includes('data')) return Database;
  if (lower.includes('excel') || lower.includes('sheet')) return FileSpreadsheet;
  return BookOpen;
}

export function HomePage() {
  const { settings } = useSite();
  const [posts, setPosts] = useState<Post[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  // Hero carousel
  const [slideIdx, setSlideIdx] = useState(0);

  // Newsletter state
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [subMessage, setSubMessage] = useState('');

  // Free Live Sessions & Resource Hub search, filter & video modal
  const [resQuery, setResQuery] = useState('');
  const [resCategory, setResCategory] = useState('all');
  const [activeVideo, setActiveVideo] = useState<Resource | null>(null);

  useEffect(() => {
    if (settings) {
      updateDocumentMeta(settings.seo_default_title, settings.seo_default_description);
    }
  }, [settings]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<Post[]>('/api/posts'),
      apiFetch<Program[]>('/api/programs'),
      apiFetch<Resource[]>('/api/resources'),
    ])
      .then(([postList, progList, resList]) => {
        if (!active) return;
        setPosts(postList);
        setPrograms(progList);
        setResources(resList);
      })
      .catch(() => {
        // Handled by empty states
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const slides = settings?.hero_slides || [];
  const activeSlide = slides[slideIdx % Math.max(1, slides.length)];

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const featuredPosts = useMemo(() => {
    const flagged = posts.filter((p) => p.featured);
    if (flagged.length >= 2) return flagged.slice(0, 2);
    return posts.slice(0, 2);
  }, [posts]);

  const recentHeadlines = useMemo(() => {
    const featuredIds = new Set(featuredPosts.map((p) => p.id));
    const nonFeatured = posts.filter((p) => !featuredIds.has(p.id));
    return (nonFeatured.length >= 4 ? nonFeatured : posts).slice(0, 4);
  }, [posts, featuredPosts]);

  const resourceFilterTabs = useMemo(
    () => [
      { key: 'all', label: 'All Resources' },
      ...RESOURCE_HUB_CATEGORIES.map((cat) => ({ key: cat, label: cat })),
    ],
    []
  );

  const filteredResources = useMemo(
    () => filterResources(resources, { query: resQuery, category: resCategory }),
    [resources, resQuery, resCategory]
  );

  const programCounts = useMemo(
    () => ({
      mentorship: filterPrograms(programs, { level: 'mentorship' }).length,
      researchMethods: filterPrograms(programs, { level: 'research_methods' }).length,
      fourIr: filterPrograms(programs, { level: '4ir' }).length,
      freeSessions: filterPrograms(programs, { level: 'free_sessions' }).length,
      degrees: programs.filter(
        (p) => p.level === 'undergraduate' || p.level === 'postgraduate'
      ).length,
    }),
    [programs]
  );

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(subEmail)) {
      setSubStatus('error');
      setSubMessage('Please enter a valid email address.');
      return;
    }
    setSubStatus('submitting');
    setSubMessage('');
    try {
      const res = await apiFetch<{ message: string }>('/api/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email: subEmail.trim() }),
      });
      setSubStatus('success');
      setSubMessage(res.message);
      setSubEmail('');
    } catch (err) {
      setSubStatus('error');
      setSubMessage(err instanceof Error ? err.message : 'Unable to subscribe at this time.');
    }
  }

  return (
    <div>
      {/* 1. Institutional Hero Carousel */}
      <section aria-label="Featured Institutional Highlights" className="relative bg-[#181F29] overflow-hidden">
        {activeSlide ? (
          <div className="relative min-h-[520px] lg:min-h-[600px] flex items-center">
            <SafeImage
              src={activeSlide.image_url}
              alt={activeSlide.headline}
              priority
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#181F29]/95 via-[#181F29]/80 to-[#181F29]/35"
              aria-hidden="true"
            />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 w-full">
              <div key={activeSlide.id || slideIdx} className="max-w-2xl space-y-6">
                <ScrollReveal immediate delay={0} variant="fade-up">
                  <p className="text-xs sm:text-[13px] font-semibold uppercase tracking-[0.14em] text-[#F78F1E]">
                    {activeSlide.kicker}
                  </p>
                </ScrollReveal>
                <ScrollReveal immediate delay={90} variant="fade-up">
                  <h1 className="font-serif text-3xl sm:text-5xl lg:text-[52px] font-bold text-white leading-[1.12] tracking-tight">
                    {activeSlide.headline}
                  </h1>
                </ScrollReveal>
                <ScrollReveal immediate delay={170} variant="fade-up">
                  <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl">
                    {activeSlide.subheadline}
                  </p>
                </ScrollReveal>
                <ScrollReveal immediate delay={250} variant="fade-up">
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <Link
                      to={activeSlide.primary_cta_link || '/programs'}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#008398] hover:bg-[#006B7D] text-white text-sm font-semibold rounded transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md whitespace-nowrap shrink-0"
                    >
                      {activeSlide.primary_cta_label}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    {activeSlide.secondary_cta_label && (
                      <a
                        href={sanitizeUrl(activeSlide.secondary_cta_link) || '#knowledge-hub'}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/30 text-sm font-semibold rounded transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                      >
                        {activeSlide.secondary_cta_label}
                      </a>
                    )}
                  </div>
                </ScrollReveal>
              </div>

              {slides.length > 1 && (
                <div className="mt-12 flex items-center justify-between border-t border-white/15 pt-5">
                  <div className="flex items-center gap-3">
                    {slides.map((s, idx) => (
                      <button
                        key={s.id || idx}
                        type="button"
                        onClick={() => setSlideIdx(idx)}
                        aria-label={`View slide ${idx + 1}: ${s.kicker}`}
                        className={`h-1.5 transition-all rounded-xs ${
                          idx === slideIdx % slides.length
                            ? 'w-10 bg-[#F78F1E]'
                            : 'w-5 bg-white/35 hover:bg-white/60'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-xs font-mono tabular-nums text-slate-300">
                      0{(slideIdx % slides.length) + 1} / 0{slides.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSlideIdx((prev) => (prev - 1 + slides.length) % slides.length)}
                      aria-label="Previous hero slide"
                      className="w-9 h-9 inline-flex items-center justify-center border border-white/25 text-white hover:bg-white/10 rounded transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlideIdx((prev) => (prev + 1) % slides.length)}
                      aria-label="Next hero slide"
                      className="w-9 h-9 inline-flex items-center justify-center border border-white/25 text-white hover:bg-white/10 rounded transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-[420px] flex items-center justify-center text-white/70 text-sm">
            Loading institutional showcase...
          </div>
        )}
      </section>

      {/* 2. Newsletter / Intake Alerts Strip */}
      <section
        aria-label="Admissions and Research Alerts Subscription"
        className="bg-[#F8FAFC] border-b border-slate-200"
      >
        <ScrollReveal variant="slide-up" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h2 className="font-sans text-sm font-semibold text-[#181F29]">
                Receive Intake Alerts, Policy Briefs & Executive Seminar Dates
              </h2>
              <p className="text-xs text-slate-600">
                Direct institutional dispatches from the Office of Admissions and Center for Applied Research.
              </p>
            </div>

            <form
              onSubmit={handleSubscribe}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto"
              noValidate
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Email address for intake alerts
              </label>
              <input
                id="newsletter-email"
                type="email"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                placeholder="Enter your institutional or personal email"
                className="w-full sm:w-80 px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded text-[#181F29] placeholder:text-slate-400 focus:border-[#008398] focus:ring-2 focus:ring-[#008398]/15"
              />
              <button
                type="submit"
                disabled={subStatus === 'submitting'}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#181F29] hover:bg-[#242E3D] disabled:opacity-60 rounded transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
              >
                {subStatus === 'submitting' ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
          </div>
          {subMessage && (
            <div
              role="status"
              className={`mt-3 text-xs font-medium flex items-center gap-1.5 ${
                subStatus === 'success' ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {subStatus === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{subMessage}</span>
            </div>
          )}
        </ScrollReveal>
      </section>

      {/* 3. NEPAD-Style "What's New" Editorial News Grid (2-Column) */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal variant="fade-up">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-slate-200">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#D95316] mb-2">
                  Editorial & Institutional Dispatches
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#181F29]">
                  What’s New at GIPT
                </h2>
              </div>
              <Link
                to="/insights"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#008398] hover:text-[#181F29] transition-colors whitespace-nowrap shrink-0"
              >
                View All Insights
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </ScrollReveal>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10">
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="h-80 bg-slate-100 animate-pulse rounded" />
                ))}
              </div>
              <div className="lg:col-span-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 animate-pulse rounded" />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pt-10 items-start">
              {/* Left Column: 2 Featured Articles */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {featuredPosts.map((post, idx) => (
                  <ScrollReveal
                    key={post.id}
                    as="article"
                    delay={idx * 110}
                    variant="fade-up"
                    className="group flex flex-col border border-slate-200 bg-white rounded overflow-hidden hover:border-slate-300 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  >
                    <Link
                      to={`/insights/${post.slug}`}
                      className="block aspect-[4/3] overflow-hidden bg-slate-100"
                    >
                      <SafeImage
                        src={post.cover_image}
                        alt={post.title}
                        fallbackTitle={post.category_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      />
                    </Link>
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-3">
                        <span className="font-semibold text-[#008398]">
                          {post.category_name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(post.published_at || post.created_at)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{post.reading_time} min read</span>
                      </div>
                      <h3 className="font-serif text-xl font-bold text-[#181F29] leading-snug mb-3 group-hover:text-[#008398] transition-colors">
                        <Link to={`/insights/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-5 flex-1">
                        {post.excerpt}
                      </p>
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium text-[#181F29]">{post.author_name}</span>
                        <Link
                          to={`/insights/${post.slug}`}
                          className="inline-flex items-center gap-1 font-semibold text-[#008398] hover:text-[#181F29]"
                        >
                          Read Article
                          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              {/* Right Column: 4 Recent Headlines Digest */}
              <ScrollReveal
                as="aside"
                delay={180}
                variant="fade-up"
                className="lg:col-span-4 bg-[#F8FAFC] border border-slate-200 rounded p-6"
              >
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.1em] text-[#181F29] whitespace-nowrap">
                    Recent Briefs
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap shrink-0">
                    {posts.length} Published
                  </span>
                </div>
                <ul className="divide-y divide-slate-200">
                  {recentHeadlines.map((item) => (
                    <li key={item.id} className="py-4 first:pt-4 last:pb-2 group">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                        <span className="font-medium text-[#D95316]">{item.category_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(item.published_at || item.created_at)}</span>
                      </div>
                      <Link
                        to={`/insights/${item.slug}`}
                        className="block font-serif text-[17px] font-semibold text-[#181F29] group-hover:text-[#008398] leading-snug transition-colors"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="pt-5 mt-2 border-t border-slate-200">
                  <Link
                    to="/insights"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#181F29] bg-white border border-slate-300 hover:border-[#181F29] rounded transition-colors"
                  >
                    Browse All Insights & Events
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </ScrollReveal>
            </div>
          )}
        </div>
      </section>

      {/* 4. Academic Programs & Training Pathways Grid */}
      <section className="py-16 lg:py-20 bg-[#F8FAFC] border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal variant="fade-up">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#008398] mb-2">
                  Academic & Executive Architecture
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#181F29]">
                  Programs & Professional Pathways
                </h2>
              </div>
              <Link
                to="/programs"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#008398] hover:text-[#181F29] transition-colors whitespace-nowrap shrink-0"
              >
                View Full Program Catalog
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                key: 'mentorship',
                title: 'Research Mentorship Programme',
                meta: '01 · Flagship Programme',
                icon: Award,
                accentBg: 'bg-[#F26422]',
                statusText: 'Flagship · Enrolment Open for Scholars & Students',
                statusColor: 'text-[#D95316]',
                summary:
                  'Our signature programme where enrolled students are paired directly with experienced mentors across every stage of research—from topic formulation and proposal writing to data analysis, thesis completion, and publication.',
                link: '/programs?level=mentorship',
                ctaLabel: 'Enroll in Research Mentorship',
              },
              {
                key: 'research_methods',
                title: 'Research Methods Short Courses (Aug – Sept)',
                meta: `02 · ${programCounts.researchMethods} Scheduled Courses`,
                icon: Calendar,
                accentBg: 'bg-[#008398]',
                statusText: 'MK85,000 Online · MK550,000 Physical (Blantyre & Lilongwe)',
                statusColor: 'text-[#008398]',
                summary:
                  'Eleven 5-day practical courses covering Foundation of Research, Information Retrieval & Referencing, Proposal Writing, Quantitative/Qualitative/Mixed Designs, Data Collection, Stata, NVivo, and Excel.',
                link: '/programs?level=research_methods',
                ctaLabel: 'View August – September Calendar',
              },
              {
                key: '4ir',
                title: '4th Industrial Revolution (4IR) Short Courses',
                meta: `03 · ${programCounts.fourIr} Active Courses`,
                icon: Cpu,
                accentBg: 'bg-[#00B1CB]',
                statusText: 'Now Enrolling · Public & Corporate Cohorts',
                statusColor: 'text-[#008398]',
                summary:
                  'Hands-on technology cohorts in Applied Data Science & Machine Learning, AI Literacy & Workflow Automation, Cloud Infrastructure & Cybersecurity, and IoT / Industry 4.0 Foundations.',
                link: '/programs?level=4ir',
                ctaLabel: 'Explore 4IR Courses',
              },
              {
                key: 'free_sessions',
                title: 'Free Information Sessions (Research & Technology)',
                meta: `04 · ${programCounts.freeSessions} Open Sessions`,
                icon: Presentation,
                accentBg: 'bg-[#F78F1E]',
                statusText: 'Free Access · Live Open Webinars & Q&A',
                statusColor: 'text-emerald-700',
                summary:
                  'Complimentary interactive sessions covering diverse subjects in research methodology, analytical software, academic publishing, and emerging 4IR technologies—open to all students and professionals.',
                link: '/programs?level=free_sessions',
                ctaLabel: 'Browse Free Info Sessions',
              },
            ].map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <ScrollReveal
                  key={pillar.key}
                  delay={idx * 85}
                  variant="fade-up"
                  className="group relative overflow-hidden bg-white border border-slate-200 rounded p-7 flex flex-col justify-between hover:border-[#008398]/50 hover:-translate-y-1 hover:shadow-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                >
                  {/* Subtle top-border accent slide on hover */}
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 left-0 right-0 h-[3px] ${pillar.accentBg} origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
                  />
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="inline-flex items-center justify-center w-11 h-11 rounded bg-[#181F29] text-white transition-transform duration-300 group-hover:scale-105">
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {pillar.meta}
                      </span>
                    </div>
                    <h3 className="font-serif text-2xl font-bold text-[#181F29] mb-2 group-hover:text-[#008398] transition-colors">
                      {pillar.title}
                    </h3>
                    <p className={`text-xs font-semibold mb-3 ${pillar.statusColor}`}>
                      {pillar.statusText}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6">{pillar.summary}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <Link
                      to={pillar.link}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#008398] hover:text-[#181F29] transition-colors"
                    >
                      {pillar.ctaLabel}
                      <ArrowRight
                        className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          {/* Upcoming Degree Programmes Notice Strip */}
          <ScrollReveal delay={180} variant="slide-up">
            <div className="mt-6 bg-white border border-slate-200 rounded px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded bg-slate-100 text-[#181F29] shrink-0 mt-0.5">
                  <GraduationCap className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#D95316]">
                    Undergraduate & Postgraduate Degrees · {programCounts.degrees > 0 ? `${programCounts.degrees} Programs` : 'Not Yet Offered (Coming Soon)'}
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Full undergraduate and postgraduate degree programmes are currently under institutional development. Register early interest to receive launch announcements.
                  </p>
                </div>
              </div>
              <Link
                to="/contact?category=Future+Undergraduate+%2F+Postgraduate+Interest"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#181F29] bg-[#F8FAFC] border border-slate-300 hover:border-[#181F29] rounded transition-colors whitespace-nowrap shrink-0 self-start md:self-center"
              >
                Register Early Interest
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 5. Free Live Sessions & Resource Hub (Dark Slate #132232 Band) */}
      <section id="knowledge-hub" className="py-16 lg:py-20 bg-[#132232] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal variant="fade-up">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-slate-700/80">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F78F1E] mb-2">
                  LIVE LEARNING & OPEN RESOURCES
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white">
                  Free Live Sessions & Resource Hub
                </h2>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Watch recorded live training sessions and download shared presentations, practice datasets, and research toolkits directly from GIPT faculty.
                </p>
              </div>

              <div className="relative w-full lg:w-80">
                <label htmlFor="knowledge-search" className="sr-only">
                  Search live sessions, presentations, datasets, and toolkits
                </label>
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="knowledge-search"
                  type="search"
                  value={resQuery}
                  onChange={(e) => setResQuery(e.target.value)}
                  placeholder="Search sessions, slides, datasets..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#0D1926] border border-slate-600/90 rounded text-white placeholder:text-slate-400 focus:border-[#00B1CB]"
                />
              </div>
            </div>
          </ScrollReveal>

          {/* Interactive Filter Controls */}
          <ScrollReveal delay={60} variant="slide-up">
            <div
              role="tablist"
              aria-label="Filter live sessions and open resources"
              className="flex flex-wrap items-center gap-2 py-6"
            >
              {resourceFilterTabs.map((tab) => {
                const active = resCategory === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setResCategory(tab.key)}
                    className={`px-3.5 py-2 text-xs font-medium rounded transition-all duration-200 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-[#132232] font-semibold shadow-xs'
                        : 'bg-[#1B2F44] text-slate-300 hover:bg-[#243D57] hover:text-white border border-slate-700/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </ScrollReveal>

          {filteredResources.length === 0 ? (
            <div className="py-12 text-center border border-slate-700/80 rounded bg-[#0F1C2A]">
              <p className="text-sm text-slate-300">
                No sessions or resources matched your current search or filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResQuery('');
                  setResCategory('all');
                }}
                className="mt-3 text-xs font-semibold text-[#F78F1E] underline underline-offset-4"
              >
                Reset hub filters
              </button>
            </div>
          ) : (
            <div
              key={`${resCategory}-${resQuery.trim()}`}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredResources.map((res, idx) => {
                const videoId = getResourceYouTubeId(res);
                const downloadable = hasDownloadableFile(res);
                const safeHref = downloadable ? sanitizeUrl(res.file_url) : '';
                const isInternalApi = safeHref.startsWith('/api/resources/');
                const fileLabel = getResourceFileLabel(res);
                const CatIcon = getCategoryIcon(res.category);

                return (
                  <article
                    key={res.id}
                    style={{ animationDelay: `${Math.min(idx * 65, 390)}ms` }}
                    className="gipt-card-enter group bg-[#192B3E] border border-slate-700/80 rounded overflow-hidden flex flex-col justify-between hover:border-[#00B1CB]/60 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  >
                    <div>
                      {videoId ? (
                        <ResourceVideoThumbnail
                          videoId={videoId}
                          title={res.title}
                          dateBadge={res.publication_year}
                          onPlay={() => setActiveVideo(res)}
                        />
                      ) : (
                        <div className="px-6 pt-6 pb-2 flex items-center justify-between gap-3">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded bg-[#0F1D2C] border border-slate-700 text-[#00B1CB] transition-transform duration-300 group-hover:scale-105">
                            <CatIcon className="w-5 h-5" aria-hidden="true" />
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-300">
                            {fileLabel}
                          </span>
                        </div>
                      )}

                      <div className="p-6 pt-4">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mb-2.5">
                          <span className="font-semibold text-[#F78F1E]">{res.category}</span>
                          {!videoId && res.publication_year && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{res.publication_year}</span>
                            </>
                          )}
                          {videoId && downloadable && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-slate-300">
                                {fileLabel}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="font-serif text-lg font-semibold text-white leading-snug mb-2.5 group-hover:text-[#00B1CB] transition-colors">
                          {res.title}
                        </h3>
                        <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed line-clamp-3">
                          {res.summary}
                        </p>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-[#122030] border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-2.5">
                      {videoId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveVideo(res)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded transition-colors whitespace-nowrap shrink-0"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                            Watch Session
                          </button>
                          {downloadable && safeHref ? (
                            <a
                              href={isInternalApi ? `${safeHref}?download=1` : safeHref}
                              download
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white hover:text-[#132232] bg-transparent hover:bg-white border border-slate-500 hover:border-white rounded transition-colors whitespace-nowrap shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              Download Resource
                            </a>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-400">
                              Free On-Demand Replay
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <a
                            href={safeHref || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-[#F78F1E] transition-colors whitespace-nowrap"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                            Preview
                            <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
                          </a>
                          <a
                            href={isInternalApi ? `${safeHref}?download=1` : safeHref || '#'}
                            download
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#132232] bg-white hover:bg-slate-100 rounded transition-colors whitespace-nowrap shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            Download Resource
                          </a>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 6. Why Choose GIPT & Impact Counters (Claim-to-Proof Adjacency) */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-5">
              <ScrollReveal variant="fade-up">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#D95316] mb-3">
                  The GIPT Advantage
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#181F29] leading-tight">
                  Grounded in Research. Engineered for Institutional Impact.
                </h2>
                <p className="mt-4 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                  Students, ministries, and regional employers choose GIPT because our qualifications connect rigorous academic foundations directly with verifiable organizational outcomes.
                </p>
              </ScrollReveal>

              <ul className="space-y-3 pt-2 text-sm text-[#181F29]">
                {[
                  'Flagship Research Mentorship pairing enrolled students with dedicated academic mentors',
                  '11 structured Research Methods short courses (Online evening & Physical in Blantyre/Lilongwe)',
                  'Applied 4IR Skills cohorts in data science, AI automation, cloud security, and IoT',
                  'Free Information Sessions on diverse research and technology subjects open to all',
                ].map((point, idx) => (
                  <ScrollReveal
                    key={idx}
                    as="li"
                    delay={80 + idx * 70}
                    variant="slide-up"
                    className="flex items-start gap-2.5"
                  >
                    <CheckCircle2
                      className="w-4 h-4 text-[#008398] mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </ScrollReveal>
                ))}
              </ul>

              <ScrollReveal delay={340} variant="fade-up">
                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <Link
                    to="/why-choose-us"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#181F29] hover:bg-[#242E3D] rounded transition-all duration-200 hover:-translate-y-0.5"
                  >
                    Why Choose GIPT
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#008398] hover:text-[#181F29]"
                  >
                    Speak with Admissions
                  </Link>
                </div>
              </ScrollReveal>
            </div>

            {/* 4 Admin-Editable Institutional Impact Metrics with Viewport Count-Up */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(settings?.impact_stats || []).map((stat, idx) => (
                <ScrollReveal
                  key={idx}
                  delay={idx * 90}
                  variant="scale-in"
                  className="bg-[#F8FAFC] border border-slate-200 rounded p-7 flex flex-col justify-between hover:border-[#008398]/40 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300"
                >
                  <CountUpStat
                    value={stat.value}
                    className="font-serif text-4xl sm:text-[42px] font-bold tabular-nums text-[#181F29] tracking-tight leading-none"
                  />
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h3 className="font-sans text-sm font-semibold text-[#181F29] mb-1">
                      {stat.label}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{stat.context}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Responsive YouTube Session Video Player Modal */}
      <VideoModal resource={activeVideo} onClose={() => setActiveVideo(null)} />
    </div>
  );
}
