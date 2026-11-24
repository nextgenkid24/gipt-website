import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch } from '../../lib/api';
import type { User, UserRole } from '../../types';
import { AdminLayout } from './AdminLayout';

export function UsersManager() {
  const { user: currentUser, settings } = useSite();
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('author');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    updateDocumentMeta(`Authors & Users — ${settings?.institute_short_name || 'GIPT'} CMS`);
  }, [settings?.institute_short_name]);

  async function loadUsers() {
    setUsers(await apiFetch<User[]>('/api/admin/users'));
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName('');
    setEmail('');
    setRole('author');
    setTitle('');
    setBio('');
    setPassword('');
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setTitle(u.title);
    setBio(u.bio);
    setPassword('');
    setFeedback(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        email: email.trim(),
        role,
        title: title.trim(),
        bio: bio.trim(),
      };
      if (password) payload.password = password;

      if (editingId) {
        await apiFetch(`/api/admin/users/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: 'User account updated.' });
      } else {
        await apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'success', text: 'User account created.' });
      }
      await loadUsers();
      resetForm();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save user.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: User) {
    setFeedback(null);
    try {
      await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
      if (editingId === u.id) resetForm();
      setFeedback({ type: 'success', text: `Removed user ${u.name}.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to delete user.',
      });
    }
  }

  return (
    <AdminLayout title="Authors & Users Manager">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded p-6 space-y-4">
            <h2 className="font-serif text-xl font-bold text-[#181F29]">
              {editingId ? 'Edit Staff / Author Account' : 'Add New Author or Admin'}
            </h2>
            {feedback && (
              <div
                role="status"
                className={`p-3 text-xs rounded border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {feedback.text}
              </div>
            )}
            <div>
              <label htmlFor="usr-name" className="block text-xs font-semibold text-[#181F29] mb-1">
                Full Name *
              </label>
              <input
                id="usr-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              />
            </div>
            <div>
              <label htmlFor="usr-email" className="block text-xs font-semibold text-[#181F29] mb-1">
                Email Address *
              </label>
              <input
                id="usr-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              />
            </div>
            <div>
              <label htmlFor="usr-role" className="block text-xs font-semibold text-[#181F29] mb-1">
                Access Role *
              </label>
              <select
                id="usr-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded"
              >
                <option value="author">Author (Own Posts & Profile)</option>
                <option value="super_admin">Super Admin (Full Institutional CMS)</option>
              </select>
            </div>
            <div>
              <label htmlFor="usr-title" className="block text-xs font-semibold text-[#181F29] mb-1">
                Academic / Professional Title
              </label>
              <input
                id="usr-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Lecturer, School of Economics"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              />
            </div>
            <div>
              <label htmlFor="usr-bio" className="block text-xs font-semibold text-[#181F29] mb-1">
                Author Bio (displayed beneath published articles)
              </label>
              <textarea
                id="usr-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              />
            </div>
            <div>
              <label htmlFor="usr-pw" className="block text-xs font-semibold text-[#181F29] mb-1">
                {editingId ? 'Reset Password (leave blank to keep current)' : 'Initial Password * (min 8 chars)'}
              </label>
              <input
                id="usr-pw"
                type="password"
                required={!editingId}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
              >
                {saving ? 'Saving...' : editingId ? 'Update Account' : 'Create Account'}
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

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded overflow-x-auto h-fit">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#181F29]">{u.name}</div>
                    <div className="text-xs text-slate-500">
                      {u.email} {u.title ? `· ${u.title}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                    <span className={u.role === 'super_admin' ? 'text-[#008398]' : 'text-slate-600'}>
                      {u.role === 'super_admin' ? 'Super Admin' : 'Author'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      aria-label={`Edit ${u.name}`}
                      className="p-1.5 text-slate-500 hover:text-[#181F29]"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        aria-label={`Delete ${u.name}`}
                        className="p-1.5 text-slate-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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

export function ProfileManager() {
  const { user, setUser, settings } = useSite();
  const [name, setName] = useState(user?.name || '');
  const [title, setTitle] = useState(user?.title || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    updateDocumentMeta(`My Profile — ${settings?.institute_short_name || 'GIPT'} CMS`);
  }, [settings?.institute_short_name]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch<{ user: User }>('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, title, bio, password: password || undefined }),
      });
      setUser(res.user);
      setPassword('');
      setFeedback({ type: 'success', text: 'Your editorial profile has been updated.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update profile.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="My Author Profile">
      <form
        onSubmit={handleSave}
        className="max-w-2xl bg-white border border-slate-200 rounded p-6 sm:p-8 space-y-5"
      >
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#181F29]">Author Profile & Bio</h2>
          <p className="text-xs text-slate-500 mt-1">
            Signed in as <span className="font-mono">{user?.email}</span>
          </p>
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3 text-sm rounded border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div>
          <label htmlFor="prof-name" className="block text-xs font-semibold text-[#181F29] mb-1">
            Display Name
          </label>
          <input
            id="prof-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded"
          />
        </div>

        <div>
          <label htmlFor="prof-title" className="block text-xs font-semibold text-[#181F29] mb-1">
            Academic / Institutional Title
          </label>
          <input
            id="prof-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded"
          />
        </div>

        <div>
          <label htmlFor="prof-bio" className="block text-xs font-semibold text-[#181F29] mb-1">
            Editorial Bio
          </label>
          <textarea
            id="prof-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded"
          />
        </div>

        <div>
          <label htmlFor="prof-pw" className="block text-xs font-semibold text-[#181F29] mb-1">
            Change Password (optional, min 8 characters)
          </label>
          <input
            id="prof-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </AdminLayout>
  );
}
