import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch, uploadAdminFile } from '../../lib/api';
import type { Resource } from '../../types';
import { AdminLayout } from './AdminLayout';

const EMPTY_RESOURCE = {
  id: null as number | null,
  title: '',
  category: 'Prospectus',
  summary: '',
  file_url: '',
  publication_year: String(new Date().getFullYear()),
  file_size: '1.2 MB PDF',
};

const RESOURCE_CATEGORIES = [
  'Prospectus',
  'Academic Calendar',
  'Policy Brief',
  'Research Paper',
  'Brochure',
  'Academic Guide',
];

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
    updateDocumentMeta(`Knowledge & Publications — ${settings?.institute_short_name || 'GIPT'} CMS`);
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
        file_size: `${res.size} ${file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'FILE'}`,
      }));
      setFeedback({ type: 'success', text: 'Document file uploaded.' });
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
      setFeedback({ type: 'error', text: 'Publication title is required.' });
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
        setFeedback({ type: 'success', text: 'Publication updated.' });
      } else {
        await apiFetch('/api/admin/resources', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setFeedback({ type: 'success', text: 'Publication added to Knowledge Hub.' });
      }
      await loadResources();
      setEditing(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save publication.',
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
        text: err instanceof Error ? err.message : 'Unable to delete publication.',
      });
    }
  }

  return (
    <AdminLayout title="Knowledge & Publications Manager">
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
                {form.id ? 'Edit Publication' : 'Add Institutional Publication'}
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
                  {saving ? 'Saving...' : 'Save Publication'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="res-title" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Document Title *
                </label>
                <input
                  id="res-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div>
                <label htmlFor="res-cat" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Category
                </label>
                <select
                  id="res-cat"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                >
                  {RESOURCE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="res-year" className="block text-xs font-semibold text-[#181F29] mb-1">
                    Year
                  </label>
                  <input
                    id="res-year"
                    type="text"
                    value={form.publication_year}
                    onChange={(e) => setForm((p) => ({ ...p, publication_year: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label htmlFor="res-size" className="block text-xs font-semibold text-[#181F29] mb-1">
                    Format / Size
                  </label>
                  <input
                    id="res-size"
                    type="text"
                    value={form.file_size}
                    onChange={(e) => setForm((p) => ({ ...p, file_size: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="res-summary" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Document Summary
                </label>
                <textarea
                  id="res-summary"
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="res-url" className="block text-xs font-semibold text-[#181F29]">
                  Document URL (or upload PDF file below; leave blank to auto-generate institutional sheet)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="res-url"
                    type="text"
                    value={form.file_url}
                    onChange={(e) => setForm((p) => ({ ...p, file_url: e.target.value }))}
                    placeholder="/uploads/... or https://..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                  <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#181F29] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Uploading...' : 'Upload PDF'}</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 tabular-nums">
                {resources.length} publications in the Knowledge Hub
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
                Add Publication
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Publication</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Year / Format</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Loading publications...
                      </td>
                    </tr>
                  ) : (
                    resources.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#181F29]">{res.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-1">{res.summary}</div>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#D95316] whitespace-nowrap">
                          {res.category}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                          {res.publication_year} · {res.file_size}
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
                                file_url: res.file_url,
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
