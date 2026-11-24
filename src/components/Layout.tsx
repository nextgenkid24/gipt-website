import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { sanitizeUrl } from '../utils/cmsUtils';

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Why Choose Us', to: '/why-choose-us' },
  { label: 'Programs & Trainings', to: '/programs' },
  { label: 'Insights & News', to: '/insights' },
  { label: 'Contact', to: '/contact' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { settings } = useSite();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const location = useLocation();

  const shortName = settings?.institute_short_name || 'GIPT';
  const fullName = settings?.institute_name || 'Global Institute For Postgraduate Training';
  const logoUrl = sanitizeUrl(settings?.logo_url) || '/assets/aistudio/1_8b905cc5.png';
  const showAnnouncement = Boolean(
    settings?.announcement_enabled && settings.announcement_text && !announcementDismissed
  );

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#181F29]">
      {/* GIPT Signature Tri-Color Institutional Ribbon (Amber · Cyan · Orange) */}
      <div className="h-[3px] w-full flex" aria-hidden="true">
        <span className="flex-1 bg-[#F78F1E]" />
        <span className="flex-1 bg-[#00B1CB]" />
        <span className="flex-1 bg-[#F26422]" />
      </div>

      {/* Top Announcement Bar (non-sticky so mobile sticky height stays strictly minimal) */}
      {showAnnouncement && (
        <div className="bg-[#181F29] text-white border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4 text-xs sm:text-[13px]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[#F78F1E] font-semibold whitespace-nowrap shrink-0">
                Notice
              </span>
              <span className="text-slate-200 truncate">{settings?.announcement_text}</span>
              {settings?.announcement_link_label && settings?.announcement_link_url && (
                <Link
                  to={settings.announcement_link_url}
                  className="hidden sm:inline-flex items-center gap-1 text-white font-medium underline underline-offset-4 decoration-[#F78F1E] hover:text-[#F78F1E] transition-colors whitespace-nowrap shrink-0"
                >
                  {settings.announcement_link_label}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAnnouncementDismissed(true)}
              aria-label="Dismiss announcement"
              className="text-slate-300 hover:text-white p-1 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Clean Sticky Institutional Header (3 zones: Brand — Nav Links — Primary CTA) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-[72px] flex items-center justify-between gap-6">
          {/* Zone 1: Official Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group"
            onClick={() => setMobileMenuOpen(false)}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={fullName}
                className="h-9 sm:h-10 lg:h-11 w-auto object-contain"
              />
            ) : (
              <>
                <span className="inline-flex items-center justify-center w-8 h-8 bg-[#181F29] text-white font-serif font-bold text-base tracking-tight">
                  G
                </span>
                <span className="font-serif text-xl font-bold tracking-tight text-[#181F29] group-hover:text-[#008398] transition-colors">
                  {shortName}
                </span>
              </>
            )}
          </Link>

          {/* Zone 2: Single-Line Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 xl:gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`text-[14px] font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'text-[#181F29] border-[#00B1CB]'
                      : 'text-slate-600 border-transparent hover:text-[#181F29] hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Zone 3: Primary CTA + Mobile Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/contact"
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-[13px] font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded transition-colors whitespace-nowrap shrink-0"
            >
              Inquire Now
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 text-[#181F29] hover:bg-slate-100 rounded transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <nav
              aria-label="Mobile Navigation"
              className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1"
            >
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-3 py-2.5 text-sm font-medium rounded transition-colors ${
                      isActive
                        ? 'bg-[#F8FAFC] text-[#008398]'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-[#181F29]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="pt-3 mt-2 border-t border-slate-100">
                <Link
                  to="/contact"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded transition-colors"
                >
                  Inquire Now
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Institutional Editorial Footer */}
      <footer className="bg-[#181F29] text-slate-300 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
            <div className="lg:col-span-4 space-y-4">
              {logoUrl ? (
                <div className="inline-block bg-white px-3.5 py-2 rounded">
                  <img
                    src={logoUrl}
                    alt={fullName}
                    className="h-10 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-white text-[#181F29] font-serif font-bold text-base">
                    G
                  </span>
                  <span className="font-serif text-xl font-bold text-white">{shortName}</span>
                </div>
              )}
              <p className="text-sm leading-relaxed text-slate-300 max-w-sm">
                {settings?.tagline ||
                  'Flagship Research Mentorship, Research Methods Short Courses, 4IR Skills & Free Research-Tech Information Sessions.'}
              </p>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#F78F1E]">
                Institute
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    About GIPT
                  </Link>
                </li>
                <li>
                  <Link to="/why-choose-us" className="hover:text-white transition-colors">
                    Why Choose Us
                  </Link>
                </li>
                <li>
                  <Link to="/insights" className="hover:text-white transition-colors">
                    Insights & News
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    Contact & Admissions
                  </Link>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#F78F1E]">
                Active Trainings & Roadmap
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link
                    to="/programs?level=mentorship"
                    className="hover:text-white transition-colors"
                  >
                    Flagship Research Mentorship
                  </Link>
                </li>
                <li>
                  <Link
                    to="/programs?level=research_methods"
                    className="hover:text-white transition-colors"
                  >
                    Research Methods Short Courses
                  </Link>
                </li>
                <li>
                  <Link
                    to="/programs?level=4ir"
                    className="hover:text-white transition-colors"
                  >
                    4IR Skills Short Courses
                  </Link>
                </li>
                <li>
                  <Link
                    to="/programs?level=free_sessions"
                    className="hover:text-white transition-colors"
                  >
                    Free Info Sessions (Research & Tech)
                  </Link>
                </li>
                <li>
                  <Link
                    to="/programs?level=degrees"
                    className="hover:text-white transition-colors"
                  >
                    Degrees (Coming Soon)
                  </Link>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#F78F1E]">
                Campus Registry
              </h3>
              <div className="space-y-2 text-sm text-slate-300">
                <p>{settings?.contact_address}</p>
                <p className="tabular-nums">{settings?.contact_phone_primary}</p>
                <p>{settings?.contact_email_admissions}</p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
            <p>
              © {new Date().getFullYear()} {fullName}. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {settings?.social_linkedin && (
                <a
                  href={sanitizeUrl(settings.social_linkedin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  LinkedIn
                </a>
              )}
              {settings?.social_twitter && (
                <a
                  href={sanitizeUrl(settings.social_twitter)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  X / Twitter
                </a>
              )}
              <Link to="/admin" className="text-slate-300 hover:text-white transition-colors">
                CMS Portal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
