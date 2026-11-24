import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch } from '../../lib/api';
import type { DashboardStats, Inquiry, Post } from '../../types';
import { formatDate } from '../../utils/cmsUtils';
import { AdminLayout } from './AdminLayout';

export function AdminDashboard() {
  const { user, settings } = useSite();
  const isSuperAdmin = user?.role === 'super_admin';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [recentInquiries, setRecentInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    updateDocumentMeta(`CMS Overview — ${settings?.institute_short_name || 'GIPT'}`);
  }, [settings?.institute_short_name]);

  useEffect(() => {
    let active = true;
    const requests: Promise<unknown>[] = [
      apiFetch<DashboardStats>('/api/admin/stats'),
      apiFetch<Post[]>('/api/admin/posts'),
    ];
    if (isSuperAdmin) {
      requests.push(apiFetch<Inquiry[]>('/api/admin/inquiries'));
    }

    Promise.all(requests)
      .then(([st, posts, inqs]) => {
        if (!active) return;
        setStats(st as DashboardStats);
        setRecentPosts((posts as Post[]).slice(0, 5));
        if (inqs) setRecentInquiries((inqs as Inquiry[]).slice(0, 5));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  return (
    <AdminLayout title="Dashboard Overview">
      <div className="space-y-8">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#181F29]">
            Welcome back, {user?.name}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {isSuperAdmin
              ? 'Manage academic programs, institutional publications, editorial articles, inquiries, and site configuration.'
              : 'Draft, edit, and publish your assigned research articles and manage your editorial bio.'}
          </p>
        </div>

        {/* Metrics Grid */}
        {loading || !stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white border border-slate-200 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Published Articles
              </p>
              <p className="font-mono text-3xl font-semibold tabular-nums text-[#181F29] mt-2">
                {stats.published_posts}
              </p>
              <p className="text-xs text-slate-500 mt-1 tabular-nums">
                {stats.draft_posts} drafts in queue
              </p>
            </div>

            {isSuperAdmin && (
              <>
                <div className="bg-white border border-slate-200 rounded p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Academic Programs
                  </p>
                  <p className="font-mono text-3xl font-semibold tabular-nums text-[#181F29] mt-2">
                    {stats.total_programs}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {stats.total_resources} repository publications
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Admissions Inquiries
                  </p>
                  <p className="font-mono text-3xl font-semibold tabular-nums text-[#008398] mt-2">
                    {stats.new_inquiries}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    New · {stats.total_inquiries} total received
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Alert Subscribers
                  </p>
                  <p className="font-mono text-3xl font-semibold tabular-nums text-[#181F29] mt-2">
                    {stats.total_subscribers}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {stats.total_users} active CMS accounts
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Posts */}
          <div className={`${isSuperAdmin ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white border border-slate-200 rounded`}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-sans text-sm font-semibold text-[#181F29]">
                Recent Editorial Articles
              </h3>
              <Link
                to="/admin/posts"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#008398] hover:text-[#181F29]"
              >
                Manage Posts
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {recentPosts.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No articles created yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentPosts.map((post) => (
                  <li key={post.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#181F29] truncate">{post.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {post.category_name} · {post.author_name} ·{' '}
                        {formatDate(post.published_at || post.created_at)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        post.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {post.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Inquiries (Super Admin Only) */}
          {isSuperAdmin && (
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-[#181F29]">
                  Latest Admissions Inquiries
                </h3>
                <Link
                  to="/admin/inbox"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#008398] hover:text-[#181F29]"
                >
                  Open Inbox
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              {recentInquiries.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No inquiries yet.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentInquiries.map((inq) => (
                    <li key={inq.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#181F29] truncate">
                          {inq.name}{' '}
                          <span className="font-normal text-slate-500">({inq.category})</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {inq.program_of_interest || inq.message}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          inq.status === 'new'
                            ? 'text-[#008398]'
                            : inq.status === 'in_progress'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {inq.status === 'in_progress'
                          ? 'In Progress'
                          : inq.status === 'resolved'
                          ? 'Resolved'
                          : 'New'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
