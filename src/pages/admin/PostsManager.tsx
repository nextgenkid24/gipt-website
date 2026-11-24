import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';
import { SafeImage } from '../../components/SafeImage';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch, uploadAdminFile } from '../../lib/api';
import type { Post, PostStatus } from '../../types';
import { calculateReadingTime, formatDate, slugify } from '../../utils/cmsUtils';
import { AdminLayout } from './AdminLayout';

interface PostFormState {
  id: number | null;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  content: string;
  cover_image: string;
  category_id: string;
  tags: string;
  featured: boolean;
  status: PostStatus;
}

const EMPTY_FORM: PostFormState = {
  id: null,
  title: '',
  slug: '',
  slugTouched: false,
  excerpt: '',
  content: '',
  cover_image: '',
  category_id: '',
  tags: '',
  featured: false,
  status: 'published',
};

export function PostsManager() {
  const { user, categories, settings } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperAdmin = user?.role === 'super_admin';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PostFormState>(EMPTY_FORM);
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    updateDocumentMeta(`Posts Manager — ${settings?.institute_short_name || 'GIPT'} CMS`);
  }, [settings?.institute_short_name]);

  async function loadPosts() {
    setLoading(true);
    try {
      const data = await apiFetch<Post[]>('/api/admin/posts');
      setPosts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openNewEditor();
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function openNewEditor() {
    setFeedback(null);
    setEditorMode('write');
    setForm({
      ...EMPTY_FORM,
      category_id: categories[0] ? String(categories[0].id) : '',
    });
    setEditing(true);
  }

  function openEditEditor(post: Post) {
    setFeedback(null);
    setEditorMode('write');
    setForm({
      id: post.id,
      title: post.title,
      slug: post.slug,
      slugTouched: true,
      excerpt: post.excerpt,
      content: post.content,
      cover_image: post.cover_image,
      category_id: post.category_id ? String(post.category_id) : '',
      tags: post.tags,
      featured: post.featured,
      status: post.status,
    });
    setEditing(true);
  }

  function handleTitleChange(val: string) {
    setForm((prev) => ({
      ...prev,
      title: val,
      slug: prev.slugTouched ? prev.slug : slugify(val),
    }));
  }

  function insertMarkdownSnippet(snippet: string) {
    setForm((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content}\n\n${snippet}` : snippet,
    }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const uploaded = await uploadAdminFile(file);
      setForm((prev) => ({ ...prev, cover_image: uploaded.url }));
      setFeedback({ type: 'success', text: 'Cover image uploaded.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Upload failed.',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (form.title.trim().length < 3) {
      setFeedback({ type: 'error', text: 'Article title must be at least 3 characters.' });
      return;
    }
    if (form.content.trim().length < 10) {
      setFeedback({ type: 'error', text: 'Article content must be at least 10 characters.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        cover_image: form.cover_image.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        tags: form.tags.trim(),
        featured: form.featured,
        status: form.status,
      };

      if (form.id) {
        await apiFetch(`/api/admin/posts/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: 'Article updated successfully.' });
      } else {
        await apiFetch('/api/admin/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: 'Article created successfully.' });
      }
      await loadPosts();
      setEditing(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save article.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(post: Post) {
    setFeedback(null);
    try {
      await apiFetch(`/api/admin/posts/${post.id}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setFeedback({ type: 'success', text: `Deleted "${post.title}".` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete post.',
      });
    }
  }

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (q && !`${p.title} ${p.slug} ${p.tags} ${p.author_name || ''}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [posts, search, statusFilter]);

  const liveReadTime = calculateReadingTime(form.content);

  return (
    <AdminLayout title="Posts & Insights Manager">
      <div className="space-y-6">
        {feedback && (
          <div
            role="status"
            className={`p-3.5 text-sm rounded border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#181F29]">
                  {form.id ? 'Edit Article' : 'Compose New Article'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  Estimated reading time: <strong className="text-[#181F29]">{liveReadTime} min</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] disabled:opacity-60 rounded"
                >
                  {saving ? 'Saving...' : form.id ? 'Update Article' : 'Publish / Save Article'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-5">
                <div>
                  <label htmlFor="post-title" className="block text-xs font-semibold text-[#181F29] mb-1.5">
                    Headline *
                  </label>
                  <input
                    id="post-title"
                    type="text"
                    required
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Enter authoritative editorial headline"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
                  />
                </div>

                <div>
                  <label htmlFor="post-slug" className="block text-xs font-semibold text-[#181F29] mb-1.5">
                    SEO URL Slug
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 py-2.5 text-xs font-mono text-slate-500 bg-slate-50 border border-r-0 border-slate-300 rounded-l">
                      /insights/
                    </span>
                    <input
                      id="post-slug"
                      type="text"
                      value={form.slug}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          slug: slugify(e.target.value),
                          slugTouched: true,
                        }))
                      }
                      className="flex-1 px-3 py-2.5 text-xs font-mono border border-slate-300 rounded-r focus:border-[#008398]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="post-excerpt" className="block text-xs font-semibold text-[#181F29] mb-1.5">
                    Summary Excerpt (used on cards & SEO meta description)
                  </label>
                  <textarea
                    id="post-excerpt"
                    rows={2}
                    value={form.excerpt}
                    onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                    placeholder="Concise 1–2 sentence overview..."
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
                  />
                </div>

                {/* Markdown Editor */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label htmlFor="post-content" className="text-xs font-semibold text-[#181F29]">
                      Article Content (Markdown) *
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => insertMarkdownSnippet('## Section Heading')}
                        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdownSnippet('### Subheading')}
                        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                      >
                        H3
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdownSnippet('> Key institutional pull quote.')}
                        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                      >
                        Quote
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdownSnippet('- Key point one\n- Key point two')}
                        className="px-2 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50"
                      >
                        List
                      </button>
                      <div className="ml-2 flex items-center bg-slate-100 p-0.5 rounded">
                        <button
                          type="button"
                          onClick={() => setEditorMode('write')}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            editorMode === 'write' ? 'bg-white text-[#181F29] shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorMode('preview')}
                          className={`px-2.5 py-1 text-xs font-medium rounded ${
                            editorMode === 'preview' ? 'bg-white text-[#181F29] shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  </div>

                  {editorMode === 'write' ? (
                    <textarea
                      id="post-content"
                      rows={14}
                      required
                      value={form.content}
                      onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                      placeholder="Write structured institutional prose using Markdown headings (##), lists (-), bold (**text**), and quotes (>)."
                      className="w-full px-3.5 py-3 text-sm font-mono border border-slate-300 rounded focus:border-[#008398]"
                    />
                  ) : (
                    <div className="min-h-[320px] p-6 border border-slate-200 rounded bg-[#F8FAFC]">
                      {form.content.trim() ? (
                        <MarkdownRenderer content={form.content} dropCap />
                      ) : (
                        <p className="text-sm text-slate-400">Nothing to preview yet.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Sidebar Metadata */}
              <div className="lg:col-span-4 space-y-5 bg-[#F8FAFC] border border-slate-200 rounded p-5 h-fit">
                <div>
                  <label htmlFor="post-status" className="block text-xs font-semibold text-[#181F29] mb-1.5">
                    Publication Status
                  </label>
                  <select
                    id="post-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, status: e.target.value as PostStatus }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                  >
                    <option value="published">Published (Live on Website)</option>
                    <option value="draft">Draft (Hidden from Public)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="post-category" className="block text-xs font-semibold text-[#181F29] mb-1.5">
                    Category
                  </label>
                  <select
                    id="post-category"
                    value={form.category_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="post-tags" className="block text-xs font-semibold text-[#181F29] mb-1.5">
                    Tags (comma-separated)
                  </label>
                  <input
                    id="post-tags"
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="Governance, Economics, Admissions"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                  />
                </div>

                {isSuperAdmin && (
                  <label className="flex items-center gap-2.5 text-sm text-[#181F29] pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) => setForm((prev) => ({ ...prev, featured: e.target.checked }))}
                      className="w-4 h-4 accent-[#008398]"
                    />
                    <span className="text-xs font-medium">
                      Highlight in Home “What’s New” Featured Slots
                    </span>
                  </label>
                )}

                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <label htmlFor="post-cover" className="block text-xs font-semibold text-[#181F29]">
                    Featured Cover Image URL
                  </label>
                  <input
                    id="post-cover"
                    type="text"
                    value={form.cover_image}
                    onChange={(e) => setForm((prev) => ({ ...prev, cover_image: e.target.value }))}
                    placeholder="/src/assets/images/... or upload below"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                  />
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#181F29] bg-white border border-slate-300 hover:border-[#181F29] rounded cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{uploading ? 'Uploading...' : 'Upload Image File'}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                  {form.cover_image && (
                    <div className="aspect-[4/3] rounded overflow-hidden border border-slate-200 bg-slate-100">
                      <SafeImage
                        src={form.cover_image}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search articles..."
                  aria-label="Search CMS posts"
                  className="w-full sm:w-64 px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                />
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | PostStatus)}
                  className="px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                </select>
              </div>
              <button
                type="button"
                onClick={openNewEditor}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Compose Article
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Article</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Author</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading articles...
                      </td>
                    </tr>
                  ) : filteredPosts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No articles found.
                      </td>
                    </tr>
                  ) : (
                    filteredPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 max-w-md">
                          <div className="font-semibold text-[#181F29] truncate">{post.title}</div>
                          <div className="text-xs font-mono text-slate-400 truncate">
                            /insights/{post.slug} · {post.reading_time} min
                            {post.featured ? ' · Featured' : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {post.category_name}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {post.author_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold ${
                              post.status === 'published' ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {post.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {formatDate(post.published_at || post.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {post.status === 'published' && (
                              <Link
                                to={`/insights/${post.slug}`}
                                aria-label={`View ${post.title}`}
                                className="p-1.5 text-slate-500 hover:text-[#008398] rounded"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditEditor(post)}
                              aria-label={`Edit ${post.title}`}
                              className="p-1.5 text-slate-500 hover:text-[#181F29] rounded"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(post)}
                              aria-label={`Delete ${post.title}`}
                              className="p-1.5 text-slate-500 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
