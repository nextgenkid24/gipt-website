import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileImage,
  Info,
  Monitor,
  Search,
  X,
} from 'lucide-react';
import { updateDocumentMeta, useSite } from '../context/SiteContext';
import { apiFetch } from '../lib/api';
import type { Program } from '../types';
import {
  filterPrograms,
  isFreeSessionProgram,
  isResearchMentorshipProgram,
  isResearchMethodsCourse,
} from '../utils/cmsUtils';

type ProgramFilterTab =
  | 'active'
  | 'mentorship'
  | 'research_methods'
  | '4ir'
  | 'free_sessions'
  | 'degrees';

const LEVEL_TABS: Array<{ id: ProgramFilterTab; label: string }> = [
  { id: 'active', label: 'All Active' },
  { id: 'mentorship', label: 'Research Mentorship' },
  { id: 'research_methods', label: 'Research Methods' },
  { id: '4ir', label: '4IR Skills' },
  { id: 'free_sessions', label: 'Free Sessions' },
  { id: 'degrees', label: 'Degrees (Soon)' },
];

const STUDY_MODES = ['all', 'Online', 'Physical', 'Blantyre', 'Lilongwe', 'Blended'];

const OFFICIAL_CALENDAR_IMAGE =
  '/assets/aistudio/780380845_122121298275364872_39160538878929447_n_dbb6fffe.jpg';
const OFFICIAL_REGISTRATION_URL = 'https://forms.gle/KeiwAs1AVPgrLFS3A';

function mapProgramToInquiryCategory(prog: Program): string {
  if (prog.level === 'undergraduate' || prog.level === 'postgraduate') {
    return 'Future Undergraduate / Postgraduate Interest';
  }
  if (isFreeSessionProgram(prog)) {
    return 'Free Information Sessions (Research & Technology)';
  }
  if (isResearchMentorshipProgram(prog)) {
    return 'Flagship Research Mentorship Programme';
  }
  if (isResearchMethodsCourse(prog)) {
    return 'Research Methods Short Courses';
  }
  return '4IR Skills Short Courses';
}

function getTrackMetaLabel(prog: Program): { label: string; status: string; statusClass: string } {
  if (isResearchMentorshipProgram(prog)) {
    return {
      label: 'Flagship Programme',
      status: 'Enrolment Open',
      statusClass: 'text-[#D95316]',
    };
  }
  if (isFreeSessionProgram(prog)) {
    return {
      label: 'Open Access',
      status: 'Free Session · RSVP Open',
      statusClass: 'text-emerald-700',
    };
  }
  if (isResearchMethodsCourse(prog)) {
    const isPhysical = prog.study_mode.toLowerCase().includes('physical');
    return {
      label: isPhysical ? 'MK550,000 (Physical)' : 'MK85,000 (Online)',
      status: 'Now Enrolling',
      statusClass: 'text-emerald-700',
    };
  }
  return {
    label: '4IR Short Course',
    status: 'Now Enrolling',
    statusClass: 'text-emerald-700',
  };
}

export function ProgramsPage() {
  const { settings } = useSite();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawParam = searchParams.get('level') || 'active';

  const normalizeTab = (val: string): ProgramFilterTab => {
    if (val === 'short_course' || val === 'all' || val === 'active') return 'active';
    if (val === 'undergraduate' || val === 'postgraduate' || val === 'degrees') return 'degrees';
    if (
      val === 'mentorship' ||
      val === 'research_methods' ||
      val === '4ir' ||
      val === 'free_sessions'
    ) {
      return val;
    }
    return 'active';
  };

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<ProgramFilterTab>(normalizeTab(rawParam));
  const [studyMode, setStudyMode] = useState('all');
  const [query, setQuery] = useState('');
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  useEffect(() => {
    updateDocumentMeta(
      `Programs & Course Calendar — ${settings?.institute_short_name || 'GIPT'}`,
      'Enroll in GIPT’s Flagship Research Mentorship Programme, August–September Research Methods Short Courses (Online, Blantyre & Lilongwe), 4IR Skills trainings, and Free Information Sessions.'
    );
  }, [settings]);

  useEffect(() => {
    setLevel(normalizeTab(searchParams.get('level') || 'active'));
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    apiFetch<Program[]>('/api/programs')
      .then((data) => {
        if (active) setPrograms(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => filterPrograms(programs, { query, level, studyMode }),
    [programs, query, level, studyMode]
  );

  const isUpcomingDegreeTab = level === 'degrees' && filtered.length === 0;

  function handleLevelSelect(next: ProgramFilterTab) {
    setLevel(next);
    if (next === 'active') {
      searchParams.delete('level');
    } else {
      searchParams.set('level', next);
    }
    setSearchParams(searchParams, { replace: true });
  }

  return (
    <div>
      {/* Header */}
      <section className="bg-[#181F29] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-3xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F78F1E]">
                Flagship Mentorship · Aug–Sept Calendar · 4IR Skills · Free Sessions
              </p>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">
                Programs & Professional Trainings
              </h1>
              <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
                Enroll in our <strong className="font-semibold text-white">Flagship Research Mentorship Programme</strong>, scheduled{' '}
                <strong className="font-semibold text-white">Research Methods Short Courses</strong> (Online & Physical in Blantyre and Lilongwe),{' '}
                <strong className="font-semibold text-white">4IR Skills</strong> cohorts, or attend our{' '}
                <strong className="font-semibold text-white">Free Information Sessions</strong> on research and technology.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowCalendarModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/25 rounded transition-colors whitespace-nowrap"
              >
                <FileImage className="w-4 h-4 text-[#F78F1E]" aria-hidden="true" />
                View Official Calendar Poster
              </button>
              <a
                href={OFFICIAL_REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded transition-colors whitespace-nowrap"
              >
                Official Registration Form
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Transparent Fee & Delivery Summary Band */}
          <div className="mt-10 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wider">
                Online Short Courses (Evening)
              </span>
              <span className="font-semibold text-white tabular-nums">
                MK85,000 · 6:00/6:30 pm – 8:30 pm
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wider">
                Physical Intensives (Blantyre & Lilongwe)
              </span>
              <span className="font-semibold text-white tabular-nums">
                MK550,000 · 8:00 am – 4:00 pm
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wider">
                Research & Tech Information Sessions
              </span>
              <span className="font-semibold text-[#F78F1E]">
                Free Open Access · Live Online Q&A
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section className="bg-[#F8FAFC] border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            {/* Level Segmented Tabs */}
            <div
              role="tablist"
              aria-label="Filter programs by training track"
              className="flex flex-wrap items-center gap-1.5"
            >
              {LEVEL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={level === tab.id}
                  onClick={() => handleLevelSelect(tab.id)}
                  className={`px-3 py-2 text-xs sm:text-sm font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    level === tab.id
                      ? 'bg-[#181F29] text-white font-semibold'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:text-[#181F29]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search & Study Mode */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <div className="relative">
                <label htmlFor="program-search" className="sr-only">
                  Search programs
                </label>
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="program-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Stata, NVivo, mentorship..."
                  className="w-full sm:w-56 pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded text-[#181F29] placeholder:text-slate-400 focus:border-[#008398]"
                />
              </div>

              <div>
                <label htmlFor="study-mode-filter" className="sr-only">
                  Filter by delivery mode or city
                </label>
                <select
                  id="study-mode-filter"
                  value={studyMode}
                  onChange={(e) => setStudyMode(e.target.value)}
                  className="w-full sm:w-40 px-3 py-2 text-sm bg-white border border-slate-300 rounded text-[#181F29] focus:border-[#008398]"
                >
                  {STUDY_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m === 'all' ? 'All Modes & Cities' : m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 tabular-nums">
            Showing <span className="font-semibold text-[#181F29]">{filtered.length}</span> active
            training {filtered.length === 1 ? 'offering' : 'offerings'}
          </div>
        </div>
      </section>

      {/* Programs List */}
      <section className="py-12 lg:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-52 bg-slate-100 animate-pulse rounded" />
              ))}
            </div>
          ) : isUpcomingDegreeTab ? (
            <div className="border border-slate-200 rounded bg-[#F8FAFC] p-8 sm:p-10 max-w-3xl mx-auto space-y-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D95316]">
                <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Institutional Offering Status</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#181F29]">
                Undergraduate & Postgraduate Degree Programmes Are Not Yet Offered
              </h2>
              <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
                At this time, GIPT is actively focused on our{' '}
                <strong>Flagship Research Mentorship Programme</strong>, scheduled{' '}
                <strong>Research Methods Short Courses</strong>,{' '}
                <strong>4th Industrial Revolution (4IR) Skills</strong> trainings, and{' '}
                <strong>Free Information Sessions</strong>. Full undergraduate and postgraduate
                degree programmes remain under institutional design and accreditation review.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  to="/contact?category=Future+Undergraduate+%2F+Postgraduate+Interest"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded transition-colors"
                >
                  Register Early Interest
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleLevelSelect('active')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#181F29] bg-white border border-slate-300 hover:border-[#181F29] rounded transition-colors"
                >
                  Browse Active Short Courses & Mentorship
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center border border-slate-200 rounded bg-[#F8FAFC]">
              <h2 className="font-serif text-xl font-semibold text-[#181F29]">
                No active trainings match your current filters
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Try adjusting your keyword search, track tab, or delivery mode selection.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStudyMode('all');
                  handleLevelSelect('active');
                }}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#181F29] rounded hover:bg-[#242E3D]"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filtered.map((prog) => {
                const highlightItems = prog.highlights
                  .split('\n')
                  .map((h) => h.trim())
                  .filter(Boolean);
                const inquiryParams = new URLSearchParams({
                  program: prog.title,
                  category: mapProgramToInquiryCategory(prog),
                });
                const meta = getTrackMetaLabel(prog);
                const isCalendarCourse = isResearchMethodsCourse(prog);
                const isFlagship = isResearchMentorshipProgram(prog);
                const isFree = isFreeSessionProgram(prog);

                return (
                  <article
                    key={prog.id}
                    className={`border rounded p-6 sm:p-8 transition-colors ${
                      isFlagship
                        ? 'border-[#181F29] bg-[#F8FAFC]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      <div className="lg:col-span-8 space-y-4">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                          <span className="font-semibold text-[#008398]">{meta.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>{prog.faculty}</span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-semibold ${meta.statusClass}`}>{meta.status}</span>
                        </div>

                        <h2 className="font-serif text-2xl sm:text-[26px] font-bold text-[#181F29] leading-snug">
                          {prog.title}
                        </h2>

                        <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
                          {prog.summary}
                        </p>

                        {highlightItems.length > 0 && (
                          <div className="pt-2">
                            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                              {isFree
                                ? 'Session Coverage'
                                : isFlagship
                                  ? 'Mentorship Structure & Outcomes'
                                  : 'Course Highlights & Schedule Details'}
                            </h3>
                            <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5 marker:text-[#D95316]">
                              {highlightItems.map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-4 bg-white border border-slate-200 rounded p-5 flex flex-col justify-between gap-5">
                        <dl className="space-y-3 text-sm">
                          <div className="flex items-start gap-2.5">
                            <Calendar
                              className="w-4 h-4 text-[#008398] mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <div>
                              <dt className="text-xs font-semibold text-slate-500">
                                {isCalendarCourse ? 'Scheduled Dates' : 'Cohort Schedule'}
                              </dt>
                              <dd className="font-medium text-[#181F29]">{prog.intake}</dd>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <Clock
                              className="w-4 h-4 text-[#008398] mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <div>
                              <dt className="text-xs font-semibold text-slate-500">
                                Duration & Time
                              </dt>
                              <dd className="font-medium text-[#181F29]">{prog.duration}</dd>
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <Monitor
                              className="w-4 h-4 text-[#008398] mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <div>
                              <dt className="text-xs font-semibold text-slate-500">
                                Delivery Mode
                              </dt>
                              <dd className="font-medium text-[#181F29]">{prog.study_mode}</dd>
                            </div>
                          </div>
                          <div className="pt-3 border-t border-slate-200">
                            <dt className="text-xs font-semibold text-slate-500 mb-1">
                              Fee & Participant Eligibility
                            </dt>
                            <dd className="text-xs text-slate-700 leading-relaxed">
                              {prog.entry_requirements}
                            </dd>
                          </div>
                        </dl>

                        <div className="space-y-2">
                          <Link
                            to={`/contact?${inquiryParams.toString()}`}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded transition-colors whitespace-nowrap"
                          >
                            {isFree
                              ? 'Reserve Free Seat'
                              : isFlagship
                                ? 'Apply for Mentorship'
                                : 'Inquire / Request Info'}
                            <ArrowRight className="w-4 h-4" aria-hidden="true" />
                          </Link>

                          {isCalendarCourse && (
                            <a
                              href={OFFICIAL_REGISTRATION_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#181F29] bg-[#F8FAFC] hover:bg-slate-100 border border-slate-300 rounded transition-colors whitespace-nowrap"
                            >
                              Register via Official Form
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Official Academic Calendar Modal */}
      {showCalendarModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Official GIPT Research Methods Short Courses Calendar"
          className="fixed inset-0 z-50 bg-[#181F29]/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCalendarModal(false)}
        >
          <div
            className="bg-white rounded max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-[#181F29]">
                  Official Research Methods Short Courses Calendar (August – September)
                </h2>
                <p className="text-xs text-slate-600">
                  MK85,000 (Online) · MK550,000 (Physical — Blantyre & Lilongwe) · +265 885 921 221
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarModal(false)}
                aria-label="Close calendar poster"
                className="p-2 text-slate-500 hover:text-[#181F29] hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto bg-slate-50 flex-1">
              <img
                src={OFFICIAL_CALENDAR_IMAGE}
                alt="GIPT Research Methods Short Courses August and September Academic Calendar"
                className="block mx-auto w-full max-w-xl h-auto object-contain rounded border border-slate-200"
              />
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <a
                href={OFFICIAL_CALENDAR_IMAGE}
                download="GIPT-Research-Methods-Calendar.jpg"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#181F29] hover:text-[#008398]"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Download Calendar Image
              </a>
              <a
                href={OFFICIAL_REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
              >
                Open Official Registration Form
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
