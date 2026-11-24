import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch } from '../../lib/api';
import type { Category } from '../../types';
import { slugify } from '../../utils/cmsUtils';
import { AdminLayout } from './AdminLayout';

export function CategoriesManager() {
  const { categories, refreshCategories, settings } = useSite();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    updateDocumentMeta(`Categories — ${settings?.institute_short_name || 'GIPT'} CMS`);
  }, [settings?.institute_short_name]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (name.trim().length < 2) {
      setMessage({ type: 'error', text: 'Category name is required.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: slugify(slug || name),
        description: description.trim(),
      };
      if (editingId) {
        await apiFetch(`/api/admin/categories/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage({ type: 'success', text: 'Category updated.' });
      } else {
        await apiFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage({ type: 'success', text: 'Category created.' });
      }
      await refreshCategories();
      resetForm();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save category.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    setMessage(null);
    try {
      await apiFetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
      await refreshCategories();
      if (editingId === cat.id) resetForm();
      setMessage({ type: 'success', text: `Deleted category "${cat.name}".` });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete category.',
      });
    }
  }

  return (
    <AdminLayout title="Categories Manager">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded p-6 space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#181F29]">
              {editingId ? 'Edit Category' : 'Add New Category'}
            </h2>
            {message && (
              <div
                role="status"
                className={`p-3 text-xs rounded border ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}
            <div>
              <label htmlFor="cat-name" className="block text-xs font-semibold text-[#181F29] mb-1">
                Category Name *
              </label>
              <input
                id="cat-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingId) setSlug(slugify(e.target.value));
                }}
                placeholder="e.g., Policy Briefs"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              />
            </div>
            <div>
              <label htmlFor="cat-slug" className="block text-xs font-semibold text-[#181F29] mb-1">
                URL Slug
              </label>
              <input
                id="cat-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="policy-briefs"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded"
              />
            </div>
            <div>
              <label htmlFor="cat-desc" className="block text-xs font-semibold text-[#181F29] mb-1">
                Description
              </label>
              <textarea
                id="cat-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
              >
                {saving ? 'Saving...' : editingId ? 'Update Category' : 'Add Category'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded overflow-hidden h-fit">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#181F29]">{cat.name}</div>
                    <div className="text-xs text-slate-500">{cat.description}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{cat.slug}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      aria-label={`Edit ${cat.name}`}
                      className="p-1.5 text-slate-500 hover:text-[#181F29]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      aria-label={`Delete ${cat.name}`}
                      className="p-1.5 text-slate-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
