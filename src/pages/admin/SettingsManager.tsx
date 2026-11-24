import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch, uploadAdminFile } from '../../lib/api';
import type { SiteSettings } from '../../types';
import { AdminLayout } from './AdminLayout';

type SettingsTab = 'identity' | 'hero' | 'impact' | 'about' | 'contact' | 'seo';

export function SettingsManager() {
  const { settings, refreshSettings } = useSite();
  const [tab, setTab] = useState<SettingsTab>('identity');
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    updateDocumentMeta(`Site Settings — ${settings?.institute_short_name || 'GIPT'} CMS`);
    if (settings && !form) {
      setForm(structuredClone(settings));
    }
  }, [settings, form]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await apiFetch<SiteSettings>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setForm(updated);
      await refreshSettings();
      setFeedback({ type: 'success', text: 'Site settings saved and published live.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save settings.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    try {
      const res = await uploadAdminFile(file);
      setForm({ ...form, logo_url: res.url });
      setFeedback({ type: 'success', text: 'Logo uploaded. Click Save Settings to publish.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Logo upload failed.',
      });
    }
  }

  if (!form) {
    return (
      <AdminLayout title="Site Settings">
        <div className="p-10 text-center text-sm text-slate-500">Loading settings...</div>
      </AdminLayout>
    );
  }

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'identity', label: 'Identity & Notice Bar' },
    { id: 'hero', label: 'Hero Slides' },
    { id: 'impact', label: 'Impact Metrics' },
    { id: 'about', label: 'About & Governance' },
    { id: 'contact', label: 'Contact & Social' },
    { id: 'seo', label: 'Default SEO' },
  ];

  return (
    <AdminLayout title="Site Settings Manager">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div role="tablist" className="flex flex-wrap items-center gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[#181F29] text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] disabled:opacity-60 rounded whitespace-nowrap"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

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

        <div className="bg-white border border-slate-200 rounded p-6 space-y-5">
          {tab === 'identity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="set-name" className="block text-xs font-semibold text-[#181F29] mb-1">
                    Institute Full Name
                  </label>
                  <input
                    id="set-name"
                    type="text"
                    value={form.institute_name}
                    onChange={(e) => setForm({ ...form, institute_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label htmlFor="set-short" className="block text-xs font-semibold text-[#181F29] mb-1">
                    Short Name / Acronym
                  </label>
                  <input
                    id="set-short"
                    type="text"
                    value={form.institute_short_name}
                    onChange={(e) => setForm({ ...form, institute_short_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="set-tagline" className="block text-xs font-semibold text-[#181F29] mb-1">
                  Institutional Tagline
                </label>
                <input
                  id="set-tagline"
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="set-logo" className="block text-xs font-semibold text-[#181F29]">
                  Logo Image URL (optional)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="set-logo"
                    type="text"
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="Leave blank to use architectural monogram"
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                  <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Logo
                    <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleLogoUpload} className="sr-only" />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-4">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-[#181F29] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.announcement_enabled}
                    onChange={(e) => setForm({ ...form, announcement_enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#008398]"
                  />
                  Enable Top Announcement Bar
                </label>

                <div>
                  <label htmlFor="set-ann-text" className="block text-xs font-semibold text-[#181F29] mb-1">
                    Announcement Bar Message
                  </label>
                  <input
                    id="set-ann-text"
                    type="text"
                    value={form.announcement_text}
                    onChange={(e) => setForm({ ...form, announcement_text: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="set-ann-lbl" className="block text-xs font-semibold text-[#181F29] mb-1">
                      Link Label
                    </label>
                    <input
                      id="set-ann-lbl"
                      type="text"
                      value={form.announcement_link_label}
                      onChange={(e) => setForm({ ...form, announcement_link_label: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label htmlFor="set-ann-url" className="block text-xs font-semibold text-[#181F29] mb-1">
                      Link Path
                    </label>
                    <input
                      id="set-ann-url"
                      type="text"
                      value={form.announcement_link_url}
                      onChange={(e) => setForm({ ...form, announcement_link_url: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'hero' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-sm font-semibold text-[#181F29]">
                  Homepage Hero Carousel Slides ({form.hero_slides.length})
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      hero_slides: [
                        ...form.hero_slides,
                        {
                          id: `slide-${Date.now()}`,
                          kicker: 'Institutional Spotlight',
                          headline: 'New Institutional Headline',
                          subheadline: 'Describe the academic or policy highlight.',
                          image_url: form.hero_slides[0]?.image_url || '',
                          primary_cta_label: 'Explore Programs',
                          primary_cta_link: '/programs',
                          secondary_cta_label: 'Contact Us',
                          secondary_cta_link: '/contact',
                        },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Slide
                </button>
              </div>

              {form.hero_slides.map((slide, idx) => (
                <div key={slide.id || idx} className="p-4 border border-slate-200 rounded bg-[#F8FAFC] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#008398]">Slide 0{idx + 1}</span>
                    {form.hero_slides.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            hero_slides: form.hero_slides.filter((_, i) => i !== idx),
                          })
                        }
                        aria-label={`Remove slide ${idx + 1}`}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={slide.kicker}
                      placeholder="Kicker"
                      onChange={(e) => {
                        const slides = [...form.hero_slides];
                        slides[idx] = { ...slide, kicker: e.target.value };
                        setForm({ ...form, hero_slides: slides });
                      }}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={slide.image_url}
                      placeholder="Image URL"
                      onChange={(e) => {
                        const slides = [...form.hero_slides];
                        slides[idx] = { ...slide, image_url: e.target.value };
                        setForm({ ...form, hero_slides: slides });
                      }}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={slide.headline}
                      placeholder="Headline"
                      onChange={(e) => {
                        const slides = [...form.hero_slides];
                        slides[idx] = { ...slide, headline: e.target.value };
                        setForm({ ...form, hero_slides: slides });
                      }}
                      className="md:col-span-2 px-3 py-2 text-sm bg-white border border-slate-300 rounded"
                    />
                    <textarea
                      rows={2}
                      value={slide.subheadline}
                      placeholder="Subheadline"
                      onChange={(e) => {
                        const slides = [...form.hero_slides];
                        slides[idx] = { ...slide, subheadline: e.target.value };
                        setForm({ ...form, hero_slides: slides });
                      }}
                      className="md:col-span-2 px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={slide.primary_cta_label}
                      placeholder="Primary CTA Label"
                      onChange={(e) => {
                        const slides = [...form.hero_slides];
                        slides[idx] = { ...slide, primary_cta_label: e.target.value };
                        setForm({ ...form, hero_slides: slides });
                      }}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={slide.primary_cta_link}
                      placeholder="Primary CTA Link"
                      onChange={(e) => {
                        const slides = [...form.hero_slides];
                        slides[idx] = { ...slide, primary_cta_link: e.target.value };
                        setForm({ ...form, hero_slides: slides });
                      }}
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'impact' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Configure the 4 institutional impact counters displayed on the Home and Why Choose Us pages.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {form.impact_stats.map((stat, idx) => (
                  <div key={idx} className="p-4 border border-slate-200 rounded bg-[#F8FAFC] space-y-2.5">
                    <div className="text-xs font-semibold text-[#008398]">Metric 0{idx + 1}</div>
                    <input
                      type="text"
                      value={stat.value}
                      placeholder="e.g., 4,800+"
                      onChange={(e) => {
                        const stats = [...form.impact_stats];
                        stats[idx] = { ...stat, value: e.target.value };
                        setForm({ ...form, impact_stats: stats });
                      }}
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={stat.label}
                      placeholder="Metric Label"
                      onChange={(e) => {
                        const stats = [...form.impact_stats];
                        stats[idx] = { ...stat, label: e.target.value };
                        setForm({ ...form, impact_stats: stats });
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      value={stat.context}
                      placeholder="Timeframe / evidence context"
                      onChange={(e) => {
                        const stats = [...form.impact_stats];
                        stats[idx] = { ...stat, context: e.target.value };
                        setForm({ ...form, impact_stats: stats });
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Institute Overview / Background
                </label>
                <textarea
                  rows={3}
                  value={form.about_overview}
                  onChange={(e) => setForm({ ...form, about_overview: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Institutional Mandate
                </label>
                <textarea
                  rows={3}
                  value={form.about_mandate}
                  onChange={(e) => setForm({ ...form, about_mandate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#181F29] mb-1">Mission</label>
                  <textarea
                    rows={3}
                    value={form.mission}
                    onChange={(e) => setForm({ ...form, mission: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#181F29] mb-1">Vision</label>
                  <textarea
                    rows={3}
                    value={form.vision}
                    onChange={(e) => setForm({ ...form, vision: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'contact' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Campus Address
                </label>
                <input
                  type="text"
                  value={form.contact_address}
                  onChange={(e) => setForm({ ...form, contact_address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Primary Phone
                </label>
                <input
                  type="text"
                  value={form.contact_phone_primary}
                  onChange={(e) => setForm({ ...form, contact_phone_primary: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Secondary / Admissions Phone
                </label>
                <input
                  type="text"
                  value={form.contact_phone_secondary}
                  onChange={(e) => setForm({ ...form, contact_phone_secondary: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Admissions Email
                </label>
                <input
                  type="email"
                  value={form.contact_email_admissions}
                  onChange={(e) => setForm({ ...form, contact_email_admissions: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  General Email
                </label>
                <input
                  type="email"
                  value={form.contact_email_general}
                  onChange={(e) => setForm({ ...form, contact_email_general: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Office Hours
                </label>
                <input
                  type="text"
                  value={form.office_hours}
                  onChange={(e) => setForm({ ...form, office_hours: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={form.social_linkedin}
                  onChange={(e) => setForm({ ...form, social_linkedin: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  X / Twitter URL
                </label>
                <input
                  type="url"
                  value={form.social_twitter}
                  onChange={(e) => setForm({ ...form, social_twitter: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
            </div>
          )}

          {tab === 'seo' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Default Document Title
                </label>
                <input
                  type="text"
                  value={form.seo_default_title}
                  onChange={(e) => setForm({ ...form, seo_default_title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#181F29] mb-1">
                  Default Meta Description
                </label>
                <textarea
                  rows={3}
                  value={form.seo_default_description}
                  onChange={(e) => setForm({ ...form, seo_default_description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </AdminLayout>
  );
}
