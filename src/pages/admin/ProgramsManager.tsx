import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch } from '../../lib/api';
import type { Program, ProgramLevel } from '../../types';
import { formatProgramLevel } from '../../utils/cmsUtils';
import { AdminLayout } from './AdminLayout';

const EMPTY_PROGRAM = {
  id: null as number | null,
  title: '',
  level: 'short_course' as ProgramLevel,
  faculty: '4th Industrial Revolution (4IR) Skills Academy',
  duration: '6 Weeks (Executive Intensive)',
  study_mode: 'Blended, Part-time',
  entry_requirements: '',
  summary: '',
  highlights: '',
  intake: 'Quarterly',
  featured: false,
};

export function ProgramsManager() {
  const { settings } = useSite();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_PROGRAM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    updateDocumentMeta(`Programs Manager — ${settings?.institute_short_name || 'GIPT'} CMS`);
  }, [settings?.institute_short_name]);

  async function loadPrograms() {
    setLoading(true);
    try {
      setPrograms(await apiFetch<Program[]>('/api/programs'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPrograms();
  }, []);

  function startNew() {
    setForm(EMPTY_PROGRAM);
    setFeedback(null);
    setEditing(true);
  }

  function startEdit(p: Program) {
    setForm({
      id: p.id,
      title: p.title,
      level: p.level,
      faculty: p.faculty,
      duration: p.duration,
      study_mode: p.study_mode,
      entry_requirements: p.entry_requirements,
      summary: p.summary,
      highlights: p.highlights,
      intake: p.intake,
      featured: p.featured,
    });
    setFeedback(null);
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (form.title.trim().length < 3) {
      setFeedback({ type: 'error', text: 'Program title is required.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const payload = { ...form };
      if (form.id) {
        await apiFetch(`/api/admin/programs/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: 'Program updated.' });
      } else {
        await apiFetch('/api/admin/programs', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: 'Program created.' });
      }
      await loadPrograms();
      setEditing(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save program.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Program) {
    try {
      await apiFetch(`/api/admin/programs/${p.id}`, { method: 'DELETE' });
      setPrograms((prev) => prev.filter((item) => item.id !== p.id));
      setFeedback({ type: 'success', text: `Deleted "${p.title}".` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete program.',
      });
    }
  }

  return (
    <AdminLayout title="Programs & Trainings Manager">
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
                {form.id ? 'Edit Academic Program' : 'Add Academic Program or Short Course'}
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
                  {saving ? 'Saving...' : 'Save Program'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="prog-title" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Program Title *
                </label>
                <input
                  id="prog-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div>
                <label htmlFor="prog-level" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Academic Level *
                </label>
                <select
                  id="prog-level"
                  value={form.level}
                  onChange={(e) => setForm((p) => ({ ...p, level: e.target.value as ProgramLevel }))}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                >
                  <option value="undergraduate">Undergraduate</option>
                  <option value="postgraduate">Postgraduate</option>
                  <option value="short_course">Short Courses & Executive Trainings</option>
                </select>
              </div>

              <div>
                <label htmlFor="prog-faculty" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Faculty / School
                </label>
                <input
                  id="prog-faculty"
                  type="text"
                  value={form.faculty}
                  onChange={(e) => setForm((p) => ({ ...p, faculty: e.target.value }))}
                  placeholder="School of Economics & Public Policy"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div>
                <label htmlFor="prog-duration" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Duration
                </label>
                <input
                  id="prog-duration"
                  type="text"
                  value={form.duration}
                  onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                  placeholder="e.g., 4 Years (8 Semesters) or 6 Weeks"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div>
                <label htmlFor="prog-mode" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Study Mode
                </label>
                <input
                  id="prog-mode"
                  type="text"
                  value={form.study_mode}
                  onChange={(e) => setForm((p) => ({ ...p, study_mode: e.target.value }))}
                  placeholder="Full-time, Part-time, Blended"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="prog-intake" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Intake Windows
                </label>
                <input
                  id="prog-intake"
                  type="text"
                  value={form.intake}
                  onChange={(e) => setForm((p) => ({ ...p, intake: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="prog-summary" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Program Overview
                </label>
                <textarea
                  id="prog-summary"
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="prog-reqs" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Entry Requirements
                </label>
                <textarea
                  id="prog-reqs"
                  rows={2}
                  value={form.entry_requirements}
                  onChange={(e) => setForm((p) => ({ ...p, entry_requirements: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="prog-highlights" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Curriculum Highlights (one item per line)
                </label>
                <textarea
                  id="prog-highlights"
                  rows={3}
                  value={form.highlights}
                  onChange={(e) => setForm((p) => ({ ...p, highlights: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600 tabular-nums">
                {programs.length} accredited programs & courses configured
              </p>
              <button
                type="button"
                onClick={startNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
              >
                <Plus className="w-4 h-4" />
                Add Program
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Program</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Duration & Mode</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Loading programs...
                      </td>
                    </tr>
                  ) : (
                    programs.map((prog) => (
                      <tr key={prog.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#181F29]">{prog.title}</div>
                          <div className="text-xs text-slate-500">{prog.faculty}</div>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#008398] whitespace-nowrap">
                          {formatProgramLevel(prog.level)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <div>{prog.duration}</div>
                          <div className="text-slate-400">{prog.study_mode}</div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => startEdit(prog)}
                            aria-label={`Edit ${prog.title}`}
                            className="p-1.5 text-slate-500 hover:text-[#181F29]"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(prog)}
                            aria-label={`Delete ${prog.title}`}
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
