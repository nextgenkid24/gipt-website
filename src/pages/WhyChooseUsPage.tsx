import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../context/SiteContext';

const ADVANTAGES = [
  {
    num: '01',
    title: 'Applied 4th Industrial Revolution (4IR) Curriculum',
    subtitle: 'Built around live data science, AI, cloud security, and IoT skills',
    description:
      'Every GIPT short course is engineered around real operational workflows—equipping trainees with Python analytics, responsible AI automation, cybersecurity resilience, and Industry 4.0 toolkits actively demanded by modern employers.',
    outcomes: [
      'Hands-on laboratory exercises using real African institutional and enterprise datasets',
      'Workplace capstone blueprints designed for immediate deployment after completion',
      'Alignment with international ISO security, data governance, and ethical AI standards',
    ],
  },
  {
    num: '02',
    title: 'Flagship Research Mentorship & Practical Methods Calendar',
    subtitle: 'End-to-end scholar mentorship paired with scheduled Online & Physical workshops',
    description:
      'In our Flagship Research Mentorship Programme, enrolled students receive structured mentorship across every aspect of research—complemented by 11 scheduled 5-day Research Methods short courses covering Proposal Writing, Quantitative/Qualitative/Mixed Designs, Stata, NVivo, and Excel.',
    outcomes: [
      'Enrolled mentees receive dedicated guidance from topic refinement through dissertation and journal publication',
      'Convenient Online evening short courses (MK85,000) and full-day Physical intensives in Blantyre & Lilongwe (MK550,000)',
      'Complimentary Free Information Sessions on diverse research and technology subjects open to everyone',
    ],
  },
  {
    num: '03',
    title: 'Practitioner-Scholar Faculty & Mentors',
    subtitle: 'Guided by senior academics and working technology & policy specialists',
    description:
      'GIPT pairs experienced university researchers with practicing data scientists, systems architects, and institutional transformation leads—ensuring every seminar balances scholarly depth with workplace execution.',
    outcomes: [
      'Small cohort ratios guaranteeing personalized code reviews and research feedback',
      'Direct mentorship across technical 4IR implementation and empirical policy design',
      'Ongoing alumni peer community spanning ministries, banks, NGOs, and universities',
    ],
  },
  {
    num: '04',
    title: 'Flexible Multi-Modal Short-Course Delivery',
    subtitle: 'Engineered for working professionals, researchers, and corporate cohorts',
    description:
      'Our four-to-eight-week modular formats eliminate the trade-off between career continuity and intensive upskilling through blended digital labs, evening sessions, and weekend clinics.',
    outcomes: [
      'Blended live instructor labs paired with structured asynchronous notebooks and guides',
      'Monthly rolling and quarterly public intakes alongside bespoke institutional cohorts',
      'Verifiable certificates of completion recognized by regional employers',
    ],
  },
  {
    num: '05',
    title: 'Transparent Roadmap Toward Future Higher Education',
    subtitle: 'Delivering immediate value today while building accredited degrees for tomorrow',
    description:
      'While GIPT currently focuses exclusively on high-impact 4IR short courses and research mentorship, our Academic Directorate is building rigorous institutional foundations toward future Undergraduate and Postgraduate degree accreditation.',
    outcomes: [
      'Honest, transparent communication on currently active vs. upcoming programme offerings',
      'Early-interest registry keeping trainees informed on future accredited degree launches',
      'Lifelong upskilling pathways that evolve alongside regional workforce needs',
    ],
  },
];

export function WhyChooseUsPage() {
  const { settings } = useSite();

  useEffect(() => {
    updateDocumentMeta(
      `Why Choose Us — ${settings?.institute_short_name || 'GIPT'}`,
      'Discover why professionals, scholars, and organizations choose GIPT for 4th Industrial Revolution (4IR) skills short courses and Research Mentorship.'
    );
  }, [settings]);

  return (
    <div>
      {/* Header */}
      <section className="bg-[#181F29] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#F78F1E]">
              Institutional Distinction
            </p>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold leading-tight">
              Why Scholars and Institutions Choose GIPT
            </h1>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
              Five structural pillars that distinguish our 4th Industrial Revolution (4IR) skills short courses and Research Mentorship cohorts across Southern Africa.
            </p>
          </div>
        </div>
      </section>

      {/* Institutional Proof Strip */}
      <section className="bg-[#F8FAFC] border-b border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(settings?.impact_stats || []).map((stat, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded p-5">
                <div className="font-serif text-3xl sm:text-4xl font-bold tabular-nums text-[#181F29] leading-none">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-[#008398] mt-1">{stat.label}</div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{stat.context}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Five Competitive Advantages */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 divide-y divide-slate-200">
          {ADVANTAGES.map((item) => (
            <div
              key={item.num}
              className="py-10 first:pt-0 last:pb-0 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              <div className="lg:col-span-5 space-y-2">
                <span className="font-mono text-xs font-semibold text-[#D95316] tracking-wider">
                  PILLAR {item.num}
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#181F29] leading-snug">
                  {item.title}
                </h2>
                <p className="text-sm font-medium text-[#008398]">{item.subtitle}</p>
              </div>
              <div className="lg:col-span-7 space-y-5">
                <p className="text-[15px] leading-relaxed text-slate-700">{item.description}</p>
                <ul className="space-y-2.5">
                  {item.outcomes.map((out, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#181F29]">
                      <CheckCircle2
                        className="w-4 h-4 text-[#008398] mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{out}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Next Step Callout */}
      <section className="bg-[#1E2734] text-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold">
              Ready to Advance Your Academic or Institutional Capability?
            </h2>
            <p className="text-sm text-slate-300">
              Enroll in our Flagship Research Mentorship Programme, explore the August–September Research Methods & 4IR Short Courses calendar, or reserve a seat in a Free Information Session.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/programs"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#008398] hover:bg-[#006B7D] text-white text-sm font-semibold rounded transition-colors whitespace-nowrap"
            >
              Browse Programs
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#181F29] hover:bg-slate-100 text-sm font-semibold rounded transition-colors whitespace-nowrap"
            >
              Inquire Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
