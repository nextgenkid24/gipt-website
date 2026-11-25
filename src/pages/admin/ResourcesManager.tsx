import React, { useEffect, useState } from 'react';
import { FileText, Pencil, PlayCircle, Plus, Trash2, Upload } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch, uploadAdminFile } from '../../lib/api';
import type { Resource } from '../../types';
import {
  extractYouTubeId,
  getResourceYouTubeId,
  getYouTubeThumbnailUrl,
  hasDownloadableFile,
  RESOURCE_HUB_CATEGORIES,
} from '../../utils/cmsUtils';
import { AdminLayout } from './AdminLayout';

const EMPTY_RESOURCE = {
  id: null as number | null,
  title: '',
  category: 'Session Recordings',
  summary: '',
  youtube_url: '',
  file_url: '',
  publication_year: String(new Date().getFullYear()),
  file_size: '',
};

function detectFriendlyFileBadge(filename: string, readableSize: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pptx')) return `PPTX Slides · ${readableSize}`;
  if (lower.endsWith('.xlsx')) return `XLSX Dataset · ${readableSize}`;
  if (lower.endsWith('.csv')) return `CSV Dataset · ${readableSize}`;
  if (lower.endsWith('.zip')) return `ZIP Toolkit · ${readableSize}`;
  if (lower.endsWith('.pdf')) return `PDF Handout · ${readableSize}`;
  if (/\.(jpg|jpeg|png|webp)$/.test(lower)) return `Image · ${readableSize}`;
  return `File · ${readableSize}`;
}

export function ResourcesManager() {
  const { settings } = useSite();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_RESOURCE);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    updateDocumentMeta(
      `Free Live Sessions & Resource Hub — ${settings?.institute_short_name || 'GIPT'} CMS`
    );
  }, [settings?.institute_short_name]);

  async function loadResources() {
    setLoading(true);
    try {
      setResources(await apiFetch<Resource[]>('/api/resources'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResources();
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const res = await uploadAdminFile(file);
      setForm((prev) => ({
        ...prev,
        file_url: res.url,
        file_size: detectFriendlyFileBadge(file.name, res.size),
      }));
      setFeedback({ type: 'success', text: `Uploaded "${file.name}" (${res.size}).` });
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
    if (form.title.trim().length < 3) {
      setFeedback({ type: 'error', text: 'Resource or session title is required.' });
      return;
    }
    if (form.youtube_url.trim() && !extractYouTubeId(form.youtube_url)) {
      setFeedback({
        type: 'error',
        text: 'Please paste a valid YouTube video URL (youtube.com/watch?v=... or youtu.be/...).',
      });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      if (form.id) {
        await apiFetch(`/api/admin/resources/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        setFeedback({ type: 'success', text: 'Resource updated.' });
      } else {
        await apiFetch('/api/admin/resources', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setFeedback({
          type: 'success',
          text: 'Added to Free Live Sessions & Resource Hub.',
        });
      }
      await loadResources();
      setEditing(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save resource.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(res: Resource) {
    try {
      await apiFetch(`/api/admin/resources/${res.id}`, { method: 'DELETE' });
      setResources((prev) => prev.filter((item) => item.id !== res.id));
      setFeedback({ type: 'success', text: `Deleted "${res.title}".` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete resource.',
      });
    }
  }

  const previewYoutubeId = extractYouTubeId(form.youtube_url) || extractYouTubeId(form.file_url);
  const categoryOptions: string[] = RESOURCE_HUB_CATEGORIES.includes(
    form.category as (typeof RESOURCE_HUB_CATEGORIES)[number]
  )
    ? [...RESOURCE_HUB_CATEGORIES]
    : [...RESOURCE_HUB_CATEGORIES, form.category];

  return (
    <AdminLayout title="Free Live Sessions & Resource Hub">
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
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h2 className="font-serif text-xl font-bold text-[#181F29]">
                {form.id ? 'Edit Session / Resource' : 'Add Live Session or Open Resource'}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
                >
                  {saving ? 'Saving...' : 'Save Resource'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="res-title" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Session / Resource Title *
                </label>
                <input
                  id="res-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Live Workshop Replay: Quantitative Analysis in Stata"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div>
                <label htmlFor="res-cat" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Resource Type / Category
                </label>
                <select
                  id="res-cat"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="res-year" className="block text-xs font-semibold text-[#181F29] mb-1">
                    Session Date / Year
                  </label>
                  <input
                    id="res-year"
                    type="text"
                    value={form.publication_year}
                    onChange={(e) => setForm((p) => ({ ...p, publication_year: e.target.value }))}
                    placeholder="Aug 2026 · 58 min"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label htmlFor="res-size" className="block text-xs font-semibold text-[#181F29] mb-1">
                    File Type / Size Badge
                  </label>
                  <input
                    id="res-size"
                    type="text"
                    value={form.file_size}
                    onChange={(e) => setForm((p) => ({ ...p, file_size: e.target.value }))}
                    placeholder="PPTX Slides · 3.4 MB"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Optional YouTube Video URL + Live Thumbnail Preview */}
              <div className="md:col-span-2 space-y-2.5 p-4 bg-[#F8FAFC] border border-slate-200 rounded">
                <label htmlFor="res-youtube" className="block text-xs font-semibold text-[#181F29]">
                  YouTube Video URL (Optional — enables automatic thumbnail & on-page video modal player)
                </label>
                <input
                  id="res-youtube"
                  type="url"
                  value={form.youtube_url}
                  onChange={(e) => setForm((p) => ({ ...p, youtube_url: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                />
                {form.youtube_url.trim() !== '' && !previewYoutubeId && (
                  <p className="text-xs text-red-700">
                    Unrecognized YouTube link. Paste a standard youtube.com/watch?v=, youtu.be/, or youtube.com/live/ URL.
                  </p>
                )}
                {previewYoutubeId && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-1">
                    <div className="relative w-44 aspect-video rounded overflow-hidden border border-slate-300 bg-[#132232] shrink-0">
                      <img
                        src={getYouTubeThumbnailUrl(previewYoutubeId)}
                        alt="YouTube thumbnail preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <PlayCircle className="w-7 h-7 text-white" />
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p className="font-semibold text-emerald-700">
                        YouTube video detected (ID: {previewYoutubeId})
                      </p>
                      <p>
                        Visitors will see this thumbnail on the homepage and can click{' '}
                        <strong className="text-[#181F29]">Watch Session</strong> to play the video in a modal.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Document / Dataset Upload or URL */}
              <div className="md:col-span-2 space-y-2">
                <label htmlFor="res-url" className="block text-xs font-semibold text-[#181F29]">
                  Document / Dataset File URL or Upload (PDF, PPTX, XLSX, CSV, ZIP, JPG/PNG — max 20 MB)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="res-url"
                    type="text"
                    value={form.file_url}
                    onChange={(e) => setForm((p) => ({ ...p, file_url: e.target.value }))}
                    placeholder="/uploads/... or https://... (optional if YouTube-only)"
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                  <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#181F29] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Uploading...' : 'Upload Resource'}</span>
                    <input
                      type="file"
                      accept=".pdf,.pptx,.xlsx,.csv,.zip,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="res-summary" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Summary / Learning Outcomes
                </label>
                <textarea
                  id="res-summary"
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="Describe what learners will gain from this session recording, slide deck, or dataset..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 tabular-nums">
                {resources.length} items in the Free Live Sessions & Resource Hub
              </p>
              <button
                type="button"
                onClick={() => {
                  setForm(EMPTY_RESOURCE);
                  setFeedback(null);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
              >
                <Plus className="w-4 h-4" />
                Add Session / Resource
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Session / Resource</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Media & Format</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Loading sessions and resources...
                      </td>
                    </tr>
                  ) : (
                    resources.map((res) => {
                      const ytId = getResourceYouTubeId(res);
                      const hasFile = hasDownloadableFile(res);
                      return (
                        <tr key={res.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#181F29]">{res.title}</div>
                            <div className="text-xs text-slate-500 line-clamp-1">{res.summary}</div>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-[#D95316] whitespace-nowrap">
                            {res.category}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              {ytId && (
                                <span className="inline-flex items-center gap-1 text-[#008398] font-sans font-semibold">
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  YouTube
                                </span>
                              )}
                              {ytId && hasFile && <span aria-hidden="true">·</span>}
                              {hasFile && (
                                <span className="inline-flex items-center gap-1 text-slate-700">
                                  <FileText className="w-3.5 h-3.5" />
                                  {res.file_size || 'File'}
                                </span>
                              )}
                              {!ytId && !hasFile && (
                                <span className="text-slate-400">{res.publication_year}</span>
                              )}
                            </div>
                            {res.publication_year && (
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                                {res.publication_year}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setForm({
                                  id: res.id,
                                  title: res.title,
                                  category: res.category,
                                  summary: res.summary,
                                  youtube_url: res.youtube_url || '',
                                  file_url: res.file_url || '',
                                  publication_year: res.publication_year,
                                  file_size: res.file_size,
                                });
                                setFeedback(null);
                                setEditing(true);
                              }}
                              aria-label={`Edit ${res.title}`}
                              className="p-1.5 text-slate-500 hover:text-[#181F29]"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(res)}
                              aria-label={`Delete ${res.title}`}
                              className="p-1.5 text-slate-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
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
