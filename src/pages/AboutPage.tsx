import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { updateDocumentMeta, useSite } from '../context/SiteContext';

export function AboutPage() {
  const { settings } = useSite();

  useEffect(() => {
    updateDocumentMeta(
      `About — ${settings?.institute_short_name || 'GIPT'}`,
      settings?.about_overview || 'Institutional mandate, mission, vision, values, and leadership.'
    );
  }, [settings]);

  const heroImage = settings?.hero_slides?.[0]?.image_url || '';

  return (
    <div>
      {/* Editorial Page Header */}
      <section className="bg-[#181F29] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F78F1E]">
              About the Institute
            </p>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">
              {settings?.institute_name || 'Global Institute of Professional Training'}
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
              {settings?.tagline}
            </p>
          </div>
        </div>
      </section>

      {/* Background & Mandate */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-7 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#008398] mb-2">
                  Institutional Background
                </p>
                <h2 className="font-serif text-3xl font-bold text-[#181F29] mb-4">
                  Scholarly Depth Anchored in Practical Reality
                </h2>
                <p className="text-[15px] leading-[1.8] text-slate-700">
                  {settings?.about_overview}
                </p>
              </div>
              <div className="pt-6 border-t border-slate-200">
                <h3 className="font-serif text-2xl font-bold text-[#181F29] mb-3">
                  Our Institutional Mandate
                </h3>
                <p className="text-[15px] leading-[1.8] text-slate-700">
                  {settings?.about_mandate}
                </p>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[320px] rounded overflow-hidden border border-slate-200">
                <SafeImage
                  src={heroImage}
                  alt="GIPT Main Campus Courtyard"
                  fallbackTitle="GIPT Campus"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 bg-[#F8FAFC] border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-200 rounded p-8 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#008398]">
                01. Mission Statement
              </p>
              <h2 className="font-serif text-2xl font-bold text-[#181F29]">Our Mission</h2>
              <p className="text-[15px] leading-relaxed text-slate-700">{settings?.mission}</p>
            </div>
            <div className="bg-[#181F29] text-white rounded p-8 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#F78F1E]">
                02. Vision Statement
              </p>
              <h2 className="font-serif text-2xl font-bold text-white">Our Vision</h2>
              <p className="text-[15px] leading-relaxed text-slate-200">{settings?.vision}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#D95316] mb-2">
              Guiding Principles
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#181F29]">
              Core Institutional Values
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(settings?.core_values || []).map((val, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded p-6 bg-white flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    0{idx + 1}
                  </span>
                  <h3 className="font-serif text-xl font-bold text-[#181F29] mt-2 mb-3">
                    {val.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{val.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Governance & Leadership */}
      <section className="py-16 lg:py-20 bg-[#F8FAFC] border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#008398] mb-2">
                Governance & Academic Council
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#181F29]">
                Institutional Leadership
              </h2>
            </div>
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#008398] hover:text-[#181F29]"
            >
              Contact the Office of the Principal
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(settings?.leadership || []).map((leader, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded p-7 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#181F29]">{leader.name}</h3>
                    <p className="text-sm font-semibold text-[#008398] mt-0.5">{leader.role}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500 text-right">
                    {leader.department}
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                  {leader.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
