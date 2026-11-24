import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { updateDocumentMeta, useSite } from '../context/SiteContext';
import { apiFetch } from '../lib/api';
import type { Post } from '../types';
import { filterPosts, formatDate, parseTags } from '../utils/cmsUtils';

export function InsightsPage() {
  const { settings, categories } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [categorySlug, setCategorySlug] = useState(searchParams.get('category') || 'all');
  const [activeTag, setActiveTag] = useState(searchParams.get('tag') || '');

  useEffect(() => {
    updateDocumentMeta(
      `Insights, News & Events — ${settings?.institute_short_name || 'GIPT'}`,
      'Policy briefs, institutional announcements, executive commentary, and academic events from GIPT.'
    );
  }, [settings]);

  useEffect(() => {
    setCategorySlug(searchParams.get('category') || 'all');
    setActiveTag(searchParams.get('tag') || '');
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    apiFetch<Post[]>('/api/posts')
      .then((data) => {
        if (active) setPosts(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const t of parseTags(p.tags)) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }, [posts]);

  const filtered = useMemo(
    () => filterPosts(posts, { query, categorySlug, tag: activeTag }),
    [posts, query, categorySlug, activeTag]
  );

  function selectCategory(slug: string) {
    setCategorySlug(slug);
    const next = new URLSearchParams(searchParams);
    if (slug === 'all') next.delete('category');
    else next.set('category', slug);
    setSearchParams(next, { replace: true });
  }

  function selectTag(tag: string) {
    const toggled = activeTag.toLowerCase() === tag.toLowerCase() ? '' : tag;
    setActiveTag(toggled);
    const next = new URLSearchParams(searchParams);
    if (!toggled) next.delete('tag');
    else next.set('tag', toggled);
    setSearchParams(next, { replace: true });
  }

  return (
    <div>
      {/* Header */}
      <section className="bg-[#181F29] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F78F1E]">
              Research, Commentary & Institutional Briefings
            </p>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">
              Insights, News & Events
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
              Evidence-based analysis from GIPT faculty, executive fellows, and institutional announcements across higher education and regional policy.
            </p>
          </div>
        </div>
      </section>

      {/* Search, Categories & Tag Filter Bar */}
      <section className="bg-[#F8FAFC] border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div
              role="tablist"
              aria-label="Filter articles by category"
              className="flex flex-wrap items-center gap-1.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={categorySlug === 'all'}
                onClick={() => selectCategory('all')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  categorySlug === 'all'
                    ? 'bg-[#181F29] text-white font-semibold'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={categorySlug === cat.slug}
                  onClick={() => selectCategory(cat.slug)}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    categorySlug === cat.slug
                      ? 'bg-[#181F29] text-white font-semibold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <label htmlFor="insights-search" className="sr-only">
                Search insights and news
              </label>
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="insights-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search articles, authors, topics..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded text-[#181F29] placeholder:text-slate-400 focus:border-[#008398]"
              />
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
              <span className="text-xs font-semibold text-slate-500 mr-1">Topics:</span>
              {allTags.map((tag) => {
                const selected = activeTag.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => selectTag(tag)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? 'bg-[#008398] text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-[#181F29] hover:text-[#181F29]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {activeTag && (
                <button
                  type="button"
                  onClick={() => selectTag('')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#181F29] ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear topic
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Articles Grid */}
      <section className="py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 bg-slate-100 animate-pulse rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center border border-slate-200 rounded bg-[#F8FAFC]">
              <h2 className="font-serif text-xl font-semibold text-[#181F29]">
                No articles found
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Try clearing your search keyword, category, or topic filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  selectCategory('all');
                  selectTag('');
                }}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#181F29] rounded hover:bg-[#242E3D]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filtered.map((post) => (
                <article
                  key={post.id}
                  className="group border border-slate-200 rounded bg-white overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
                >
                  <Link
                    to={`/insights/${post.slug}`}
                    className="block aspect-[4/3] overflow-hidden bg-slate-100"
                  >
                    <SafeImage
                      src={post.cover_image}
                      alt={post.title}
                      fallbackTitle={post.category_name}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  </Link>

                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-3">
                      <span className="font-semibold text-[#008398]">{post.category_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(post.published_at || post.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{post.reading_time} min read</span>
                    </div>

                    <h2 className="font-serif text-xl font-bold text-[#181F29] leading-snug mb-3 group-hover:text-[#008398] transition-colors">
                      <Link to={`/insights/${post.slug}`}>{post.title}</Link>
                    </h2>

                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-5 flex-1">
                      {post.excerpt}
                    </p>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#181F29] truncate">
                          {post.author_name}
                        </p>
                        {post.author_title && (
                          <p className="text-[11px] text-slate-500 truncate">{post.author_title}</p>
                        )}
                      </div>
                      <Link
                        to={`/insights/${post.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#008398] hover:text-[#181F29] whitespace-nowrap shrink-0"
                      >
                        Read
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
