import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Copy, Mail, Share2 } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { SafeImage } from '../components/SafeImage';
import { updateDocumentMeta, useSite } from '../context/SiteContext';
import { apiFetch } from '../lib/api';
import type { Post } from '../types';
import { formatDate, parseTags } from '../utils/cmsUtils';

export function SinglePostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSite();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setNotFound(false);

    apiFetch<{ post: Post; related: Post[] }>(`/api/posts/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!active) return;
        setPost(data.post);
        setRelated(data.related);
        updateDocumentMeta(
          `${data.post.title} — ${settings?.institute_short_name || 'GIPT'}`,
          data.post.excerpt
        );
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug, settings?.institute_short_name]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignored
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-6">
        <div className="h-6 w-48 bg-slate-100 animate-pulse rounded" />
        <div className="h-12 w-full bg-slate-100 animate-pulse rounded" />
        <div className="h-80 w-full bg-slate-100 animate-pulse rounded" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-4">
        <h1 className="font-serif text-3xl font-bold text-[#181F29]">Article Not Found</h1>
        <p className="text-sm text-slate-600">
          The publication you requested may have been moved or is no longer published.
        </p>
        <Link
          to="/insights"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#181F29] rounded hover:bg-[#242E3D]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Insights & News
        </Link>
      </div>
    );
  }

  const tags = parseTags(post.tags);
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedTitle = encodeURIComponent(post.title);

  return (
    <article className="bg-white">
      {/* Editorial Article Header */}
      <header className="bg-[#F8FAFC] border-b border-slate-200 py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/insights" className="inline-flex items-center gap-1 hover:text-[#181F29]">
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Insights & News
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to={`/insights?category=${encodeURIComponent(post.category_slug || '')}`}
              className="font-semibold text-[#008398] hover:underline"
            >
              {post.category_name}
            </Link>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-bold text-[#181F29] leading-[1.16] tracking-tight">
            {post.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl">
            {post.excerpt}
          </p>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
              <span className="font-semibold text-[#181F29]">{post.author_name}</span>
              {post.author_title && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{post.author_title}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{formatDate(post.published_at || post.created_at)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-500">
                {post.reading_time} min read
              </span>
            </div>

            {/* Social Share Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-500 inline-flex items-center gap-1 mr-1">
                <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                Share:
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#181F29] bg-white border border-slate-300 hover:border-[#181F29] rounded transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 text-xs font-medium text-[#181F29] bg-white border border-slate-300 hover:border-[#181F29] rounded transition-colors"
              >
                LinkedIn
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 text-xs font-medium text-[#181F29] bg-white border border-slate-300 hover:border-[#181F29] rounded transition-colors"
              >
                X
              </a>
              <a
                href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
                aria-label="Share via email"
                className="p-1.5 text-[#181F29] bg-white border border-slate-300 hover:border-[#181F29] rounded transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Cover Image & Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {post.cover_image && (
          <figure className="mb-10">
            <div className="aspect-[16/9] rounded overflow-hidden border border-slate-200 bg-slate-100">
              <SafeImage
                src={post.cover_image}
                alt={post.title}
                priority
                className="w-full h-full object-cover"
              />
            </div>
            <figcaption className="mt-2.5 text-xs text-slate-500 font-serif italic">
              {post.category_name} — {settings?.institute_name || 'Global Institute of Professional Training'}
            </figcaption>
          </figure>
        )}

        <div className="max-w-3xl mx-auto">
          <MarkdownRenderer content={post.content} dropCap />

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2">
                Filed Under:
              </span>
              {tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/insights?tag=${encodeURIComponent(tag)}`}
                  className="px-3 py-1 text-xs font-medium text-[#181F29] bg-[#F8FAFC] border border-slate-200 hover:border-[#008398] hover:text-[#008398] rounded transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Author Bio Box */}
          <div className="mt-10 p-6 sm:p-7 bg-[#F8FAFC] border border-slate-200 rounded flex flex-col sm:flex-row items-start gap-5">
            <div
              aria-hidden="true"
              className="w-12 h-12 rounded bg-[#181F29] text-white font-serif text-lg font-bold flex items-center justify-center shrink-0"
            >
              {(post.author_name || 'G').charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D95316]">
                About the Author
              </p>
              <h2 className="font-serif text-xl font-bold text-[#181F29]">{post.author_name}</h2>
              {post.author_title && (
                <p className="text-xs font-semibold text-[#008398]">{post.author_title}</p>
              )}
              {post.author_bio && (
                <p className="text-sm text-slate-600 leading-relaxed pt-1">{post.author_bio}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className="bg-[#F8FAFC] border-t border-slate-200 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#181F29]">
                Related Insights & Publications
              </h2>
              <Link
                to="/insights"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#008398] hover:text-[#181F29]"
              >
                All Insights
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-slate-200 rounded p-6 flex flex-col justify-between hover:border-slate-300 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <span className="font-semibold text-[#008398]">{item.category_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDate(item.published_at || item.created_at)}</span>
                    </div>
                    <h3 className="font-serif text-lg font-bold text-[#181F29] leading-snug mb-2">
                      <Link
                        to={`/insights/${item.slug}`}
                        className="hover:text-[#008398] transition-colors"
                      >
                        {item.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {item.excerpt}
                    </p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-100 text-xs font-semibold text-[#008398]">
                    <Link to={`/insights/${item.slug}`} className="inline-flex items-center gap-1">
                      Read Article
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
