import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch } from '../../lib/api';
import type { User } from '../../types';

export function AdminLogin() {
  const { settings, user, setUser } = useSite();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    updateDocumentMeta(`CMS Sign In — ${settings?.institute_short_name || 'GIPT'}`);
  }, [settings?.institute_short_name]);

  useEffect(() => {
    if (user) {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setUser(res.user);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center space-y-3">
          <Link to="/" className="inline-flex justify-center">
            <img
              src={settings?.logo_url || '/assets/aistudio/1_8b905cc5.png'}
              alt={settings?.institute_name || 'Global Institute For Postgraduate Training'}
              className="h-14 w-auto object-contain"
            />
          </Link>
          <p className="text-sm text-slate-600">
            Institutional Content Management & Admissions Portal
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded p-7 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 text-[#181F29] border-b border-slate-100 pb-4">
            <Lock className="w-4 h-4 text-[#008398]" aria-hidden="true" />
            <h1 className="font-sans text-base font-semibold">Staff & Author Sign In</h1>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-[#181F29] mb-1.5"
              >
                Staff Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gipt.edu.mw"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-[#181F29] mb-1.5"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#181F29] hover:bg-[#242E3D] disabled:opacity-60 rounded transition-colors"
            >
              {submitting ? 'Signing In...' : 'Sign In to CMS'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-[#181F29]">Default Seeded Accounts</p>
            <p className="font-mono">Super Admin: admin@gipt.edu.mw / Admin@1234</p>
            <p className="font-mono">Author: editor@gipt.edu.mw / Author@1234</p>
          </div>
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#181F29]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Return to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
}
