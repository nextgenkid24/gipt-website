import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../context/SiteContext';
import { apiFetch } from '../lib/api';
import type { Program } from '../types';
import { isValidEmail } from '../utils/cmsUtils';

const OFFICIAL_REGISTRATION_URL = 'https://forms.gle/KeiwAs1AVPgrLFS3A';

const INQUIRY_CATEGORIES = [
  'Flagship Research Mentorship Programme',
  'Research Methods Short Courses',
  '4IR Skills Short Courses',
  'Free Information Sessions (Research & Technology)',
  'Corporate / Institutional Training',
  'Future Undergraduate / Postgraduate Interest',
  'General',
];

export function ContactPage() {
  const { settings } = useSite();
  const [searchParams] = useSearchParams();
  const [programs, setPrograms] = useState<Program[]>([]);

  const preselectedProgram = searchParams.get('program') || '';
  const preselectedCategory = searchParams.get('category') || 'General';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState(
    INQUIRY_CATEGORIES.includes(preselectedCategory) ? preselectedCategory : 'General'
  );
  const [programOfInterest, setProgramOfInterest] = useState(preselectedProgram);
  const [message, setMessage] = useState(
    preselectedProgram
      ? `I would like to request detailed curriculum, tuition fee schedule, and admission dates for ${preselectedProgram}.`
      : ''
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedMsg, setSubmittedMsg] = useState('');

  useEffect(() => {
    updateDocumentMeta(
      `Contact & Admissions — ${settings?.institute_short_name || 'GIPT'}`,
      'Submit an academic or corporate training inquiry to the GIPT Admissions and Registry desk.'
    );
  }, [settings]);

  useEffect(() => {
    apiFetch<Program[]>('/api/programs')
      .then(setPrograms)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (preselectedProgram) {
      setProgramOfInterest(preselectedProgram);
    }
    if (INQUIRY_CATEGORIES.includes(preselectedCategory)) {
      setCategory(preselectedCategory);
    }
  }, [preselectedProgram, preselectedCategory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please provide an inquiry message of at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          category,
          program_of_interest: programOfInterest,
          message: message.trim(),
        }),
      });
      setSubmittedMsg(res.message);
      setName('');
      setEmail('');
      setPhone('');
      setProgramOfInterest('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit your inquiry.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <section className="bg-[#181F29] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F78F1E]">
              Admissions & Institutional Registry
            </p>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">
              Contact & Program Inquiries
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
              Enroll in our Flagship Research Mentorship Programme, register for August–September Research Methods Short Courses or 4IR Skills trainings, reserve a seat in our Free Information Sessions, or register early interest for upcoming degrees.
            </p>
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="border border-slate-200 rounded p-6 sm:p-8 bg-white">
              <h2 className="font-serif text-2xl font-bold text-[#181F29] mb-2">
                Submit an Institutional Inquiry
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                All inquiries are routed directly to our Admissions Registry and answered within one business day.
              </p>

              {submittedMsg ? (
                <div
                  role="status"
                  className="p-6 bg-emerald-50 border border-emerald-200 rounded space-y-3"
                >
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Inquiry Received</span>
                  </div>
                  <p className="text-sm text-emerald-900">{submittedMsg}</p>
                  <button
                    type="button"
                    onClick={() => setSubmittedMsg('')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#181F29] rounded hover:bg-[#242E3D]"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  {error && (
                    <div
                      role="alert"
                      className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded"
                    >
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-semibold text-[#181F29] mb-1.5"
                      >
                        Full Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Chisomo Phiri"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contact-email"
                        className="block text-xs font-semibold text-[#181F29] mb-1.5"
                      >
                        Email Address *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@organization.org"
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="contact-phone"
                        className="block text-xs font-semibold text-[#181F29] mb-1.5"
                      >
                        Telephone / WhatsApp
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+265 ..."
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contact-category"
                        className="block text-xs font-semibold text-[#181F29] mb-1.5"
                      >
                        Inquiry Category *
                      </label>
                      <select
                        id="contact-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded focus:border-[#008398]"
                      >
                        {INQUIRY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-program"
                      className="block text-xs font-semibold text-[#181F29] mb-1.5"
                    >
                      Program of Interest (Optional)
                    </label>
                    <select
                      id="contact-program"
                      value={programOfInterest}
                      onChange={(e) => setProgramOfInterest(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded focus:border-[#008398]"
                    >
                      <option value="">— Select a program or leave general —</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.title}>
                          {p.title}
                        </option>
                      ))}
                      {programOfInterest &&
                        !programs.some((p) => p.title === programOfInterest) && (
                          <option value={programOfInterest}>{programOfInterest}</option>
                        )}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-message"
                      className="block text-xs font-semibold text-[#181F29] mb-1.5"
                    >
                      Inquiry Message *
                    </label>
                    <textarea
                      id="contact-message"
                      rows={5}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your academic background, desired intake, or institutional training needs..."
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded focus:border-[#008398]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 text-sm font-semibold text-white bg-[#008398] hover:bg-[#006B7D] disabled:opacity-60 rounded transition-colors"
                  >
                    {submitting ? 'Submitting Inquiry...' : 'Submit Inquiry'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Campus Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded p-7 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#D95316] mb-1">
                  Campus & Registry Desk
                </p>
                <h2 className="font-serif text-2xl font-bold text-[#181F29]">
                  Direct Contact Details
                </h2>
              </div>

              <div className="space-y-5 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#008398] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Campus Address
                    </h3>
                    <p className="text-[#181F29] mt-1 leading-relaxed">
                      {settings?.contact_address}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[#008398] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Telephone Lines
                    </h3>
                    <p className="text-[#181F29] mt-1 tabular-nums">
                      Registry: {settings?.contact_phone_primary}
                    </p>
                    {settings?.contact_phone_secondary && (
                      <p className="text-slate-600 tabular-nums">
                        Admissions Desk: {settings.contact_phone_secondary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#008398] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Official Email Addresses
                    </h3>
                    <p className="text-[#181F29] mt-1">
                      Admissions: {settings?.contact_email_admissions}
                    </p>
                    <p className="text-slate-600">General: {settings?.contact_email_general}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-4 border-t border-slate-200">
                  <Clock className="w-5 h-5 text-[#008398] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Office Hours
                    </h3>
                    <p className="text-slate-700 mt-1 leading-relaxed">{settings?.office_hours}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Direct Course Registration
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ready to register for an August–September Research Methods short course (MK85,000 Online · MK550,000 Physical)?
                </p>
                <a
                  href={OFFICIAL_REGISTRATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#008398] hover:text-[#181F29]"
                >
                  Open Official Registration Form
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
