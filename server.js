// server.ts
import "dotenv/config";
import crypto2 from "crypto";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";
import express from "express";
import multer from "multer";

// server/auth.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
var AUTH_COOKIE_NAME = "gipt_session";
var EPHEMERAL_JWT_SECRET = crypto.randomBytes(32).toString("hex");
function getJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_JWT_SECRET;
}
async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
function signAuthToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}
function verifyAuthToken(token) {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded || typeof decoded.userId !== "number") return null;
    return decoded;
  } catch {
    return null;
  }
}
function setAuthCookie(req, res, token) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const isHttpsOrLocalhost = req.secure || forwardedProto.includes("https") || req.hostname === "localhost" || req.hostname === "127.0.0.1";
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (isHttpsOrLocalhost) {
    parts.push("SameSite=None", "Secure", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearAuthCookie(req, res) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const isHttpsOrLocalhost = req.secure || forwardedProto.includes("https") || req.hostname === "localhost" || req.hostname === "127.0.0.1";
  const parts = [`${AUTH_COOKIE_NAME}=`, "Path=/", "HttpOnly", "Max-Age=0"];
  if (isHttpsOrLocalhost) {
    parts.push("SameSite=None", "Secure", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}
function verifyCsrfHeader(req, res, next) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    next();
    return;
  }
  const xRequestedWith = req.headers["x-requested-with"];
  if (xRequestedWith === "XMLHttpRequest") {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        next();
        return;
      }
    } catch {
    }
  }
  res.status(403).json({ error: "Invalid request origin or missing CSRF header." });
}

// server/store.ts
import mysql from "mysql2/promise";

// src/utils/cmsUtils.ts
function slugify(input) {
  return input.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
function calculateReadingTime(markdownText) {
  const plain = markdownText.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#>*_~\-]+/g, " ").trim();
  if (!plain) return 1;
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}
function sanitizeUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) {
      return trimmed;
    }
    return "";
  } catch {
    return "";
  }
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// server/seedData.ts
var SEED_IMAGES = {
  heroCampus: "/src/assets/images/hero_campus_academic_1795549124827.jpg",
  heroForum: "/src/assets/images/hero_executive_forum_1795549122561.jpg",
  policyResearch: "/src/assets/images/article_policy_research_1795549127355.jpg",
  digitalInnovation: "/src/assets/images/article_digital_innovation_1795549123498.jpg",
  governanceSummit: "/src/assets/images/article_governance_summit_1795549122950.jpg",
  officialCalendar: "/assets/aistudio/780380845_122121298275364872_39160538878929447_n_dbb6fffe.jpg",
  officialLogo: "/assets/aistudio/1_8b905cc5.png"
};
var INITIAL_CATEGORIES = [
  {
    name: "Research Mentorship",
    slug: "research-mentorship",
    description: "Insights, supervision guides, and scholarly milestones from GIPT\u2019s Flagship Research Mentorship Programme."
  },
  {
    name: "Research Methods",
    slug: "research-methods",
    description: "Practical guides on proposal writing, Stata, NVivo, Excel analytics, and qualitative/quantitative designs."
  },
  {
    name: "4IR Skills & Technology",
    slug: "4ir-skills",
    description: "Briefs on artificial intelligence, data science, automation, and 4th Industrial Revolution capability building."
  },
  {
    name: "Free Info Sessions & Events",
    slug: "workshops-events",
    description: "Open, complimentary information sessions on research and technology, colloquia, and calendar updates."
  },
  {
    name: "Institutional News",
    slug: "institutional-news",
    description: "Official cohort announcements, academic calendar releases, and strategic roadmap updates."
  }
];
var INITIAL_PROGRAMS = [
  // ==================== FLAGSHIP RESEARCH MENTORSHIP ====================
  {
    title: "GIPT Research Mentorship Programme (Flagship)",
    slug: "gipt-research-mentorship-programme-flagship",
    level: "short_course",
    faculty: "Flagship \xB7 Research Mentorship Programme",
    duration: "Structured Mentored Cohort (Flexible Milestones)",
    study_mode: "Online & Blended Mentorship",
    entry_requirements: "Enrolment open to undergraduate/postgraduate students, thesis & dissertation writers, early-career academics, and policy researchers seeking structured end-to-end mentorship.",
    summary: "GIPT\u2019s flagship programme where enrolled students are paired with experienced research mentors across every aspect of research\u2014from topic refinement and literature synthesis to proposal writing, data analysis, thesis completion, and journal publication.",
    highlights: "Dedicated one-on-one and small-cohort mentorship across all stages of the research lifecycle\nGuided support on problem framing, methodology design, ethical clearance, and instrument validation\nHands-on coaching in quantitative (Stata, Excel, R), qualitative (NVivo), and mixed-methods analysis\nManuscript review, thesis defense preparation, and publication targeting with senior fellows",
    intake: "Rolling Enrolment \xB7 Cohort Intakes Throughout the Year",
    featured: true
  },
  // ==================== AUGUST – SEPTEMBER RESEARCH METHODS SHORT COURSES ====================
  {
    title: "Foundation of Research",
    slug: "foundation-of-research",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:30 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Open to postgraduate candidates, scholars, practitioners, and beginners building a solid grounding in scientific inquiry.",
    summary: "Establishes core philosophical, ethical, and methodological foundations of rigorous research\u2014covering problem identification, research objectives, hypotheses, and conceptual frameworks.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:30 pm \u2013 8:30 pm)\nFormulating clear research problems, questions, objectives, and theoretical frameworks\nUnderstanding research paradigms, validity, reliability, and ethical governance",
    intake: "17 \u2013 21 August (Online)",
    featured: true
  },
  {
    title: "Information Retrieval and Referencing",
    slug: "information-retrieval-and-referencing",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:00 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Ideal for students, researchers, and academics preparing literature reviews, theses, or publishable manuscripts.",
    summary: "Practical training in systematic academic database searching, critical source appraisal, plagiarism avoidance, and automated citation workflows using modern reference managers.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:00 pm \u2013 8:30 pm)\nStructured Boolean search strategies across peer-reviewed journals and scholarly repositories\nHands-on reference management, citation styles (APA, Harvard, Vancouver), and academic integrity",
    intake: "24 \u2013 28 August (Online)",
    featured: false
  },
  {
    title: "Research Proposal Writing",
    slug: "research-proposal-writing",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:30 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Designed for postgraduate students, grant applicants, and researchers preparing formal academic or institutional proposals.",
    summary: "Step-by-step intensive workshop guiding participants to draft a persuasive, committee-ready research proposal complete with aligned methodology, workplan, and ethical considerations.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:30 pm \u2013 8:30 pm)\nStructuring compelling backgrounds, problem statements, literature syntheses, and methodology chapters\nPractical proposal critique clinics, budgeting, timelines, and ethical review readiness",
    intake: "31 August \u2013 4 September (Online)",
    featured: true
  },
  {
    title: "Quantitative Research Designs",
    slug: "quantitative-research-designs",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:30 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Suitable for researchers, M&E specialists, and postgraduate students designing empirical quantitative studies.",
    summary: "Covers experimental, quasi-experimental, longitudinal, and cross-sectional quantitative designs alongside probability sampling, sample-size determination, and bias control.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:30 pm \u2013 8:30 pm)\nSelecting appropriate observational, quasi-experimental, and experimental research architectures\nPower analysis, sampling strategies, variable operationalization, and internal/external validity",
    intake: "7 \u2013 11 September (Online)",
    featured: false
  },
  {
    title: "Qualitative Research Designs",
    slug: "qualitative-research-designs",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:30 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Built for social science, health, education, and policy researchers conducting in-depth qualitative inquiry.",
    summary: "Explores phenomenology, grounded theory, case study, ethnography, and narrative designs with emphasis on purposive sampling, reflexivity, and trustworthiness criteria.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:30 pm \u2013 8:30 pm)\nAligning research questions with case study, phenomenology, grounded theory, and ethnographic designs\nEstablishing credibility, transferability, dependability, and confirmability in qualitative protocols",
    intake: "7 \u2013 11 September (Online)",
    featured: false
  },
  {
    title: "Quantitative Data Collection Methods and Data Management Tools",
    slug: "quantitative-data-collection-and-data-management-tools",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:30 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Open to field coordinators, M&E practitioners, postgraduate researchers, and survey managers.",
    summary: "Hands-on course on structured questionnaire construction, electronic data capture tools, quality-assurance checks, data cleaning protocols, and secure dataset management.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:30 pm \u2013 8:30 pm)\nInstrument design, pilot testing, and digital survey deployment for clean field data capture\nData dictionaries, validation rules, cleaning pipelines, and secure version-controlled storage",
    intake: "14 \u2013 18 September (Online)",
    featured: false
  },
  {
    title: "Qualitative Data Collection Methods and Management",
    slug: "qualitative-data-collection-methods-and-management",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:30 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Geared toward field researchers, project evaluators, and scholars collecting interview or focus-group evidence.",
    summary: "Develops practical proficiency in conducting in-depth interviews, focus group discussions, field observations, verbatim transcription, anonymization, and qualitative data archiving.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:30 pm \u2013 8:30 pm)\nCrafting semi-structured interview guides, probing techniques, and focus-group moderation skills\nSystematic transcription standards, participant confidentiality, and audit-ready file organization",
    intake: "14 \u2013 18 September (Online)",
    featured: false
  },
  {
    title: "Quantitative Data Analysis and Visualisation Using Stata",
    slug: "quantitative-data-analysis-and-visualisation-using-stata",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 8:00 am \u2013 4:00 pm",
    study_mode: "Physical (Blantyre)",
    entry_requirements: "Fee: MK550,000 (Physical \u2014 Blantyre). Recommended for researchers, economists, public health analysts, and postgraduate students bringing laptops.",
    summary: "Full-day physical intensive workshop in Blantyre teaching reproducible Stata do-file workflows, descriptive and inferential statistics, regression modeling, and publication-grade graphs.",
    highlights: "Fee: MK550,000 (Physical in Blantyre, 8:00 am \u2013 4:00 pm full-day intensive)\nReproducible data wrangling, hypothesis testing, linear/logistic regression, and diagnostics in Stata\nCreating publication-ready tables and custom statistical visualisations from real datasets",
    intake: "21 \u2013 25 September \xB7 Physical (Blantyre)",
    featured: true
  },
  {
    title: "Qualitative Data Analysis Principles Using NVivo Software",
    slug: "qualitative-data-analysis-principles-using-nvivo",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 8:00 am \u2013 4:00 pm",
    study_mode: "Physical (Blantyre)",
    entry_requirements: "Fee: MK550,000 (Physical \u2014 Blantyre). Ideal for qualitative scholars, NGO evaluators, and postgraduate researchers analyzing textual or multimedia transcripts.",
    summary: "Full-day hands-on workshop in Blantyre mastering thematic coding, framework matrices, case classifications, query visualizations, and transparent qualitative synthesis in NVivo.",
    highlights: "Fee: MK550,000 (Physical in Blantyre, 8:00 am \u2013 4:00 pm full-day intensive)\nImporting transcripts, building structured coding trees, memo writing, and inter-coder consistency\nRunning text search, matrix coding queries, and visual theme maps in NVivo software",
    intake: "21 \u2013 25 September \xB7 Physical (Blantyre)",
    featured: true
  },
  {
    title: "Quantitative Data Analysis and Visualisation Using Excel",
    slug: "quantitative-data-analysis-and-visualisation-using-excel",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 8:00 am \u2013 4:00 pm",
    study_mode: "Physical (Lilongwe)",
    entry_requirements: "Fee: MK550,000 (Physical \u2014 Lilongwe). Tailored for analysts, researchers, managers, and scholars seeking rigorous statistical workflows inside Microsoft Excel.",
    summary: "Full-day physical intensive workshop in Lilongwe covering structured dataset cleaning, PivotTables, Excel Data Analysis ToolPak, statistical testing, and executive visual dashboards.",
    highlights: "Fee: MK550,000 (Physical in Lilongwe, 8:00 am \u2013 4:00 pm full-day intensive)\nAutomated cleaning formulas, PivotTables, descriptive summaries, ANOVA, and regression in Excel\nDesigning clean analytical charts and decision-ready visual dashboards for reports and theses",
    intake: "28 September \u2013 2 October \xB7 Physical (Lilongwe)",
    featured: false
  },
  {
    title: "Mixed Methods Research Designs",
    slug: "mixed-methods-research-designs",
    level: "short_course",
    faculty: "Research Methods Short Courses",
    duration: "5 Days \xB7 6:30 pm \u2013 8:30 pm",
    study_mode: "Online",
    entry_requirements: "Fee: MK85,000 (Online). Designed for postgraduate scholars, evaluators, and researchers integrating quantitative and qualitative evidence.",
    summary: "Equips participants to design convergent, explanatory sequential, and exploratory sequential mixed-methods studies with rigorous joint displays and integrated meta-inferences.",
    highlights: "Fee: MK85,000 (Online evening sessions, 6:30 pm \u2013 8:30 pm)\nDesigning convergent, explanatory sequential, and exploratory sequential mixed-methods frameworks\nPractical strategies for data integration, triangulation, joint displays, and reporting standards",
    intake: "28 September \u2013 2 October (Online)",
    featured: false
  },
  // ==================== 4IR SKILLS SHORT COURSES ====================
  {
    title: "Applied Data Science, Machine Learning & Predictive Analytics",
    slug: "applied-data-science-machine-learning-analytics",
    level: "short_course",
    faculty: "4th Industrial Revolution (4IR) Skills Academy",
    duration: "6 Weeks (Executive Intensive)",
    study_mode: "Online, Blended",
    entry_requirements: "Open to graduates, analysts, researchers, and professionals with foundational numeracy or spreadsheet experience.",
    summary: "Hands-on 4IR short course equipping participants with Python data pipelines, supervised and unsupervised machine learning, and ethical deployment of analytics in public and corporate institutions.",
    highlights: "End-to-end data wrangling, visualization, and modeling in Python\nApplied machine learning laboratories using African economic, health, and enterprise datasets\nSupervised capstone analytics project reviewed by industry practitioners",
    intake: "Quarterly Cohorts (Feb, May, Aug, Nov)",
    featured: true
  },
  {
    title: "Artificial Intelligence Literacy, Prompt Engineering & Workflow Automation",
    slug: "ai-literacy-workflow-automation-professionals",
    level: "short_course",
    faculty: "4th Industrial Revolution (4IR) Skills Academy",
    duration: "4 Weeks (Modular Cohort)",
    study_mode: "Online, Blended",
    entry_requirements: "Designed for researchers, managers, educators, and administrative professionals across public and private sectors.",
    summary: "Practical 4IR training demystifying generative AI, intelligent process automation, institutional data privacy, and responsible AI governance for everyday research and workplace productivity.",
    highlights: "Designing reliable AI-assisted research, reporting, and operational workflows\nRisk assessment, copyright, data protection, and institutional AI policy frameworks\nLive workplace automation lab tailored to each participant\u2019s department",
    intake: "Monthly Rolling Cohorts",
    featured: true
  },
  {
    title: "Cloud Infrastructure, Cybersecurity & Digital Resilience Essentials",
    slug: "cloud-infrastructure-cybersecurity-resilience",
    level: "short_course",
    faculty: "4th Industrial Revolution (4IR) Skills Academy",
    duration: "6 Weeks (Applied Lab Track)",
    study_mode: "Online, Blended",
    entry_requirements: "Suitable for IT officers, systems administrators, technical graduates, and institutional operations leads.",
    summary: "Intensive 4IR technical short course covering modern cloud architecture, zero-trust security hygiene, threat detection, and digital continuity for public registries and growing enterprises.",
    highlights: "Hands-on cloud deployment, identity access controls, and network hardening\nIncident response tabletop exercises and vulnerability auditing checklists\nAlignment with international ISO 27001 and regional data protection standards",
    intake: "March, July & October",
    featured: false
  },
  {
    title: "Internet of Things (IoT), Smart Systems & Industry 4.0 Foundations",
    slug: "iot-smart-systems-industry-4-foundations",
    level: "short_course",
    faculty: "4th Industrial Revolution (4IR) Skills Academy",
    duration: "5 Weeks (Practical Cohort)",
    study_mode: "Blended",
    entry_requirements: "Open to engineering, agriculture, logistics, and ICT professionals seeking applied Industry 4.0 skills.",
    summary: "Explores connected sensor ecosystems, edge telemetry, smart agriculture, and supply-chain digitalization tailored to Southern African infrastructure realities.",
    highlights: "Sensor prototyping, telemetry dashboards, and low-bandwidth connectivity design\nCase clinics in precision agriculture, energy metering, and municipal water monitoring\nFeasibility blueprint for deploying smart-systems pilots inside organizations",
    intake: "April & September",
    featured: false
  },
  // ==================== FREE INFORMATION SESSIONS (RESEARCH & TECHNOLOGY) ====================
  {
    title: "Free Information Session: Research Pathways, Mentorship & Publishing Excellence",
    slug: "free-info-session-research-mentorship-publishing",
    level: "short_course",
    faculty: "Free Information Sessions (Research & Technology)",
    duration: "90 Minutes \xB7 Live Q&A",
    study_mode: "Online (Free Open Session)",
    entry_requirements: "Fee: FREE (Open Access). Open to all students, researchers, lecturers, and professionals\u2014no prerequisites required.",
    summary: "Complimentary interactive session unpacking common research roadblocks, how to choose the right research design or software (Stata, NVivo, Excel), and how GIPT\u2019s Flagship Research Mentorship Programme supports scholars.",
    highlights: "100% Free to attend with live mentor Q&A and open resource takeaways\nGuidance on selecting between quantitative, qualitative, and mixed-methods designs\nWalkthrough of enrolment pathways for the Flagship Research Mentorship Programme",
    intake: "Bi-Weekly Free Online Sessions (RSVP Open)",
    featured: true
  },
  {
    title: "Free Information Session: Emerging 4IR Technologies & AI in Modern Research",
    slug: "free-info-session-4ir-technologies-ai-research",
    level: "short_course",
    faculty: "Free Information Sessions (Research & Technology)",
    duration: "90 Minutes \xB7 Live Demo & Q&A",
    study_mode: "Online (Free Open Session)",
    entry_requirements: "Fee: FREE (Open Access). Open to students, institutional staff, and technology enthusiasts exploring practical 4IR and research tools.",
    summary: "Free open briefing examining ethical AI tools for literature mapping, data science workflows, digital productivity, and high-demand 4th Industrial Revolution skills across Southern Africa.",
    highlights: "100% Free registration covering practical technology and research innovation topics\nLive demonstrations of responsible AI workflows, data analytics, and open research tools\nInteractive Q&A with GIPT\u2019s 4IR Academy and Research Mentorship facilitators",
    intake: "Monthly Free Online Sessions (RSVP Open)",
    featured: false
  }
];
var INITIAL_POSTS = [
  {
    title: "August \u2013 September Research Methods Short Courses Calendar Now Open for Registration",
    slug: "august-september-research-methods-short-courses-calendar",
    excerpt: "Eleven practical five-day courses covering Foundation of Research, Proposal Writing, Quantitative & Qualitative Designs, Stata, NVivo, Excel, and Mixed Methods\u2014delivered Online and in Blantyre & Lilongwe.",
    content: `## Registration Open for the August \u2013 September Short Courses Calendar

The **Global Institute For Postgraduate Training (GIPT)** has published its August \u2013 September schedule of eleven intensive **Research Methods Short Courses**, engineered for postgraduate scholars, researchers, monitoring & evaluation officers, and working professionals.

### August Schedule (Online Evening Sessions)

- **17 \u2013 21 August:** Foundation of Research (*Online, 6:30 pm \u2013 8:30 pm*)
- **24 \u2013 28 August:** Information Retrieval and Referencing (*Online, 6:00 pm \u2013 8:30 pm*)
- **31 August \u2013 4 September:** Research Proposal Writing (*Online, 6:30 pm \u2013 8:30 pm*)

### September & Early October Schedule (Online & Physical Intensives)

- **7 \u2013 11 September:** Quantitative Research Designs & Qualitative Research Designs (*Online, 6:30 pm \u2013 8:30 pm*)
- **14 \u2013 18 September:** Quantitative Data Collection Methods and Data Management Tools & Qualitative Data Collection Methods and Management (*Online, 6:30 pm \u2013 8:30 pm*)
- **21 \u2013 25 September:** Quantitative Data Analysis and Visualisation Using Stata & Qualitative Data Analysis Principles Using NVivo Software (*Physical in Blantyre, 8:00 am \u2013 4:00 pm*)
- **28 September \u2013 2 October:** Quantitative Data Analysis and Visualisation Using Excel (*Physical in Lilongwe, 8:00 am \u2013 4:00 pm*)
- **28 September \u2013 2 October:** Mixed Methods Research Designs (*Online, 6:30 pm \u2013 8:30 pm*)

> Tuition fees are **MK85,000** for Online courses and **MK550,000** for Physical full-day workshops in Blantyre and Lilongwe.

### How to Register

Participants can register directly via our [Official Registration Form](https://forms.gle/KeiwAs1AVPgrLFS3A), email **info@gipt.edu.mw**, or call/WhatsApp **+265 885 921 221**.`,
    cover_image: SEED_IMAGES.policyResearch,
    category_slug: "research-methods",
    author_email: "admin@gipt.edu.mw",
    tags: "Research Methods, Academic Calendar, Stata, NVivo, Excel, Short Courses",
    featured: true,
    status: "published",
    published_at: "2026-08-03T09:00:00.000Z"
  },
  {
    title: "Inside GIPT\u2019s Flagship Research Mentorship Programme: Guided Supervision Across Every Aspect of Research",
    slug: "gipt-flagship-research-mentorship-programme",
    excerpt: "How enrolled students receive dedicated, structured mentorship spanning problem framing, methodology, statistical and qualitative analysis, dissertation writing, and publication.",
    content: `## Moving Scholars From Concept to Confident Completion

Many capable students and early-career researchers stall between an initial research idea and a defensible thesis, dissertation, or journal manuscript. Short workshops build key technical skills, but sustained progress requires ongoing, accountable supervision.

GIPT\u2019s **Flagship Research Mentorship Programme** pairs enrolled students directly with experienced academic mentors across every stage of their research journey.

### What Enrolled Mentees Receive

1. **Topic Sharpening & Literature Mastery:** Refining research questions, search strategies, and conceptual frameworks so every study starts on firm ground.
2. **Methodological Precision:** Personalized mentoring across quantitative, qualitative, and mixed-methods designs, sampling, and ethical review submissions.
3. **Applied Data Analysis Coaching:** Direct support applying Stata, NVivo, Excel, or R to the mentee\u2019s own datasets and transcripts.
4. **Academic Writing & Publication Readiness:** Iterative manuscript review, thesis defense preparation, and journal submission strategy.

> Great research is rarely written in isolation\u2014it thrives through disciplined methodological dialogue and accountable mentorship.

Enrol in the Flagship Research Mentorship Programme through our Programs page or attend one of our upcoming **Free Information Sessions** to meet our mentors.`,
    cover_image: SEED_IMAGES.heroCampus,
    category_slug: "research-mentorship",
    author_email: "editor@gipt.edu.mw",
    tags: "Research Mentorship, Flagship Programme, Thesis Supervision, Publication",
    featured: true,
    status: "published",
    published_at: "2026-07-28T08:30:00.000Z"
  },
  {
    title: "Join Our Free Information Sessions on Research & Emerging Technology",
    slug: "free-information-sessions-research-and-technology",
    excerpt: "GIPT hosts complimentary open webinars on diverse research methodology and 4IR technology subjects\u2014giving students and professionals direct access to our mentors at zero cost.",
    content: `## Open Access Knowledge for Scholars and Professionals

Alongside our scheduled Research Methods short courses, 4IR Skills trainings, and Flagship Research Mentorship Programme, GIPT regularly hosts **Free Information Sessions** covering timely topics across research and modern technology.

### Featured Session Themes

- **Research Design & Academic Publishing:** Selecting quantitative, qualitative, or mixed-methods approaches, navigating ethics review, and avoiding common thesis pitfalls.
- **Software & Analytical Tooling:** Practical orientation to Stata, NVivo, Excel, and reproducible data workflows.
- **4IR & AI in Modern Research:** Responsible use of artificial intelligence, data science workflows, and digital productivity tools for scholars and institutional teams.

All Free Information Sessions include live Q&A with GIPT facilitators and are completely free to attend. Reserve your seat via our Contact page or subscribe to our alerts strip below the hero banner.`,
    cover_image: SEED_IMAGES.governanceSummit,
    category_slug: "workshops-events",
    author_email: "admin@gipt.edu.mw",
    tags: "Free Info Sessions, Research, Technology, Webinars, Open Access",
    featured: false,
    status: "published",
    published_at: "2026-07-20T10:00:00.000Z"
  },
  {
    title: "Closing the 4th Industrial Revolution Skills Gap Across Southern African Institutions",
    slug: "closing-4ir-skills-gap-southern-african-institutions",
    excerpt: "Why practical short-course cohorts in data science, responsible AI, cloud security, and IoT build faster institutional capability than theoretical workshops.",
    content: `## Practical 4IR Capability for Modern Teams

Across Southern Africa, public institutions, financial firms, and emerging enterprises are modernizing operations rapidly. Through the **GIPT 4th Industrial Revolution (4IR) Skills Academy**, our short-course cohorts focus on measurable operational competence\u2014bridging foundational digital concepts and immediate workplace execution.

### Core Principles of GIPT\u2019s 4IR Short Courses

- **Live Institutional Datasets:** Participants analyze authentic regional economic, health, and enterprise datasets rather than toy textbook examples.
- **Responsible AI & Data Governance:** Every AI and analytics module embeds privacy compliance, bias auditing, and transparent decision oversight.
- **Workplace Capstone Blueprint:** Trainees graduate with an applied diagnostic or automation prototype ready for deployment inside their own organization.`,
    cover_image: SEED_IMAGES.digitalInnovation,
    category_slug: "4ir-skills",
    author_email: "admin@gipt.edu.mw",
    tags: "4IR Skills, Data Science, AI Literacy, Short Courses",
    featured: false,
    status: "published",
    published_at: "2026-07-14T09:00:00.000Z"
  },
  {
    title: "Institutional Roadmap: Active Short Courses, Mentorship & Preparation for Future Degrees",
    slug: "institutional-roadmap-short-courses-and-future-degrees",
    excerpt: "An official update detailing GIPT\u2019s current focus on Research Mentorship, Research Methods & 4IR short courses, and Free Info Sessions while future degrees remain in development.",
    content: `## Transparent Academic Rollout

At this stage of our institutional growth, **GIPT actively offers**:

- **Flagship Research Mentorship Programme:** Enrolment-based comprehensive research mentorship for students and scholars.
- **Research Methods Short Courses:** Scheduled 5-day Online (MK85,000) and Physical Blantyre/Lilongwe (MK550,000) courses spanning foundational inquiry through Stata, NVivo, Excel, and mixed methods.
- **4th Industrial Revolution (4IR) Skills Short Courses:** Practical trainings in Data Science, AI Automation, Cloud & Cybersecurity, and IoT.
- **Free Information Sessions:** Complimentary open sessions on research and technology topics.

### Status of Undergraduate and Postgraduate Degree Programmes

Full Undergraduate and Postgraduate degree programmes are **not yet being offered**. Prospective degree students are welcome to register early interest via our Contact page to be notified as soon as formal degree intakes open.`,
    cover_image: SEED_IMAGES.heroForum,
    category_slug: "institutional-news",
    author_email: "admin@gipt.edu.mw",
    tags: "Institutional Roadmap, Short Courses, Mentorship, Notice",
    featured: false,
    status: "published",
    published_at: "2026-07-05T11:00:00.000Z"
  },
  {
    title: "Choosing Between Stata, NVivo, and Excel for Your Research Analysis",
    slug: "choosing-between-stata-nvivo-and-excel-for-research",
    excerpt: "A practical orientation from GIPT\u2019s quantitative and qualitative workshop leads ahead of our September physical intensive clinics in Blantyre and Lilongwe.",
    content: `## Matching the Right Analytical Tool to Your Study Design

Selecting the right analysis software early saves weeks of rework during thesis or evaluation write-ups. Ahead of GIPT\u2019s September physical intensives in **Blantyre** and **Lilongwe**, here is how each tool fits into modern empirical research:

1. **Stata (Blantyre, 21 \u2013 25 Sept):** Ideal for econometric modeling, public health biostatistics, survey weighting, and fully reproducible do-file analysis.
2. **NVivo (Blantyre, 21 \u2013 25 Sept):** Purpose-built for thematic coding of interviews, focus group transcripts, policy documents, and qualitative matrix queries.
3. **Excel (Lilongwe, 28 Sept \u2013 2 Oct):** Widely accessible across ministries and NGOs for structured cleaning, PivotTables, ToolPak statistical tests, and executive visual dashboards.

All three physical intensives run **8:00 am \u2013 4:00 pm** at **MK550,000** and include hands-on guided datasets.`,
    cover_image: SEED_IMAGES.policyResearch,
    category_slug: "research-methods",
    author_email: "editor@gipt.edu.mw",
    tags: "Stata, NVivo, Excel, Blantyre, Lilongwe, Data Analysis",
    featured: false,
    status: "published",
    published_at: "2026-06-28T09:15:00.000Z"
  }
];
var INITIAL_RESOURCES = [
  {
    title: "Official GIPT Research Methods Short Courses Calendar (August \u2013 September)",
    category: "Academic Calendar",
    summary: "Official schedule of all 11 August\u2013September Research Methods short courses (Online MK85,000 \xB7 Physical Blantyre & Lilongwe MK550,000) with session times and registration details.",
    file_url: SEED_IMAGES.officialCalendar,
    publication_year: "2026",
    file_size: "Official Poster JPG"
  },
  {
    title: "Flagship Research Mentorship Programme \u2014 Enrolment & Mentee Guide",
    category: "Academic Guide",
    summary: "Complete overview of how enrolled students are paired with mentors across research design, proposal writing, data analysis, thesis completion, and journal publishing.",
    file_url: "/api/resources/2/download",
    publication_year: "2026",
    file_size: "1.6 MB PDF"
  },
  {
    title: "GIPT 4IR Skills & Research Short Courses Catalogue",
    category: "Prospectus",
    summary: "Full syllabus guide, cohort schedules, fee structures, and enrolment procedures covering Research Methods, Flagship Mentorship, and 4IR Skills tracks.",
    file_url: "/api/resources/3/download",
    publication_year: "2026",
    file_size: "2.4 MB PDF"
  },
  {
    title: "Free Information Sessions Series: Research & Technology Topics Schedule",
    category: "Brochure",
    summary: "Upcoming complimentary online session topics covering research design, reference management, Stata/NVivo orientation, and ethical AI tools for researchers.",
    file_url: "/api/resources/4/download",
    publication_year: "2026",
    file_size: "620 KB PDF"
  },
  {
    title: "Policy Brief: Accelerating 4IR & Empirical Research Capacity in Southern Africa",
    category: "Policy Brief",
    summary: "Evidence-based review of practical upskilling models in data science, AI literacy, and structured research mentorship across universities and public agencies.",
    file_url: "/api/resources/5/download",
    publication_year: "2026",
    file_size: "1.3 MB PDF"
  },
  {
    title: "Working Paper: Ethical AI Adoption & Reproducible Research Workflows",
    category: "Research Paper",
    summary: "Practical institutional framework for integrating modern computational tools into academic research while safeguarding scholarly integrity.",
    file_url: "/api/resources/6/download",
    publication_year: "2026",
    file_size: "1.8 MB PDF"
  }
];
var INITIAL_INQUIRIES = [
  {
    name: "Kondwani Banda",
    email: "kondwani.banda@gmail.com",
    phone: "+265 991 774 205",
    category: "Flagship Research Mentorship Programme",
    program_of_interest: "GIPT Research Mentorship Programme (Flagship)",
    message: "I would like to enroll in the Flagship Research Mentorship Programme for structured supervision on my postgraduate proposal, quantitative analysis, and manuscript writing.",
    status: "new",
    admin_notes: ""
  },
  {
    name: "Chisomo Phiri",
    email: "c.phiri@finance.gov.mw",
    phone: "+265 999 412 880",
    category: "Research Methods Short Courses",
    program_of_interest: "Quantitative Data Analysis and Visualisation Using Stata",
    message: "I would like to register for the 21\u201325 September Physical Stata workshop in Blantyre (MK550,000) and request an institutional pro-forma invoice.",
    status: "in_progress",
    admin_notes: "Shared registration form link and Blantyre venue details."
  },
  {
    name: "Tadala Mwale",
    email: "tmwale@enterprisebank.mw",
    phone: "+265 888 231 540",
    category: "Free Information Sessions (Research & Technology)",
    program_of_interest: "Free Information Session: Emerging 4IR Technologies & AI in Modern Research",
    message: "Please send the joining link for the next Free Information Session on AI & 4IR tools in research, as well as details for your 4IR Skills corporate cohorts.",
    status: "resolved",
    admin_notes: "Sent free session Zoom link and 4IR brochure."
  }
];
var INITIAL_SUBSCRIBERS = [
  { email: "policy.desk@developmentpartner.org" },
  { email: "hr.learning@capitalholdings.mw" },
  { email: "m.chirwa@researchnetwork.org" },
  { email: "digital.ops@enterprise.mw" }
];
var INITIAL_SITE_SETTINGS = {
  institute_name: "Global Institute For Postgraduate Training",
  institute_short_name: "GIPT",
  tagline: "Flagship Research Mentorship, Research Methods Short Courses, 4IR Skills & Free Research-Tech Information Sessions",
  logo_url: SEED_IMAGES.officialLogo,
  announcement_enabled: true,
  announcement_text: "Now Enrolling: Flagship Research Mentorship Programme, August\u2013September Research Methods Short Courses (MK85,000 Online \xB7 MK550,000 Physical), 4IR Skills & Free Info Sessions.",
  announcement_link_label: "View Course Calendar",
  announcement_link_url: "/programs",
  hero_slides: [
    {
      id: "slide-1",
      kicker: "Flagship Programme & Aug\u2013Sept Academic Calendar \xB7 Now Enrolling",
      headline: "Research Mentorship & Practical Short Courses Built for Scholars and Professionals",
      subheadline: "Enroll in our Flagship Research Mentorship Programme or join 11 scheduled Research Methods short courses (Online, Blantyre & Lilongwe) alongside hands-on 4IR Skills training.",
      image_url: SEED_IMAGES.heroCampus,
      primary_cta_label: "Explore Courses & Calendar",
      primary_cta_link: "/programs",
      secondary_cta_label: "View Official Calendar",
      secondary_cta_link: "/#knowledge-hub"
    },
    {
      id: "slide-2",
      kicker: "4IR Skills Academy & Free Research-Technology Sessions",
      headline: "Master 4th Industrial Revolution Skills & Join Free Research-Tech Info Sessions",
      subheadline: "Build applied capability in data science, AI automation, Stata, NVivo, and Excel\u2014or attend our complimentary open information sessions on emerging research and technology subjects.",
      image_url: SEED_IMAGES.heroForum,
      primary_cta_label: "Join Free Info Session",
      primary_cta_link: "/programs?level=free_sessions",
      secondary_cta_label: "Enroll in Mentorship",
      secondary_cta_link: "/programs?level=mentorship"
    }
  ],
  impact_stats: [
    {
      label: "Scheduled Research Short Courses",
      value: "11",
      context: "August \u2013 September calendar spanning Online (MK85,000) & Physical Blantyre/Lilongwe (MK550,000)"
    },
    {
      label: "Professionals & Scholars Trained",
      value: "1,450+",
      context: "Across Flagship Research Mentorship, Research Methods, and 4IR Skills cohorts"
    },
    {
      label: "Free Information Sessions",
      value: "Open",
      context: "Complimentary live webinars on diverse research methodology and modern technology topics"
    },
    {
      label: "Mentored Papers & Theses",
      value: "85+",
      context: "Proposals, dissertations, working papers, and policy briefs guided by GIPT mentors"
    }
  ],
  about_overview: "The Global Institute For Postgraduate Training (GIPT) is an independent training and research mentorship institute advancing applied scholarly and technological capability. GIPT currently runs its Flagship Research Mentorship Programme, scheduled Research Methods short courses (Online and in Blantyre & Lilongwe), 4th Industrial Revolution (4IR) skills short courses, and Free Information Sessions on research and technology\u2014while full Undergraduate and Postgraduate degree programmes remain under institutional development.",
  about_mandate: "GIPT\u2019s active mandate is to bridge practical research and digital skill gaps through end-to-end Research Mentorship, intensive Research Methods short courses (Proposal Writing, Quantitative/Qualitative/Mixed Designs, Stata, NVivo, Excel), applied 4IR Skills cohorts, and open-access Free Information Sessions on research and technology.",
  mission: "To equip students, researchers, and working professionals through structured research mentorship, practical short-course trainings, 4IR digital skills, and accessible information sessions that elevate scholarly and institutional impact.",
  vision: "To be Southern Africa\u2019s trusted institute for postgraduate research mentorship, applied 4IR capability, and future-ready higher education.",
  core_values: [
    {
      title: "Structured Research Mentorship",
      description: "Our Flagship Research Mentorship Programme pairs enrolled students with experienced mentors across every stage of research\u2014from topic selection to publication."
    },
    {
      title: "Practical Methods Mastery",
      description: "Every short course emphasizes hands-on application in proposal writing, data collection, Stata, NVivo, Excel, and mixed-methods design."
    },
    {
      title: "Applied 4IR Readiness",
      description: "We equip professionals and scholars with real-world 4th Industrial Revolution fluency in data science, AI literacy, cloud security, and smart systems."
    },
    {
      title: "Open Knowledge Access",
      description: "Through Free Information Sessions on research and technology, we open doors for emerging scholars and institutions before they commit to full cohorts."
    }
  ],
  leadership: [
    {
      name: "Prof. Hastings Chikwanda",
      role: "Principal & Lead Research Mentor",
      department: "Office of the Principal",
      bio: "Senior academic leader and quantitative research mentor with over two decades guiding postgraduate proposals, empirical policy studies, and institutional capacity building."
    },
    {
      name: "Dr. Grace Nkhoma",
      role: "Director, Flagship Research Mentorship & Methods",
      department: "Research Mentorship",
      bio: "Methodologist overseeing GIPT\u2019s Flagship Research Mentorship Programme, the August\u2013September Research Methods short courses, and future degree accreditation."
    },
    {
      name: "Dr. Chimwemwe Phiri",
      role: "Head, 4th Industrial Revolution (4IR) Skills Academy",
      department: "4IR & Technology",
      bio: "Applied data scientist and systems architect leading 4IR short courses in machine learning, AI workflow automation, cloud security, and technology info sessions."
    },
    {
      name: "Mr. Bernard Kalonga",
      role: "Coordinator, Executive Cohorts & Institutional Training",
      department: "Blantyre & Lilongwe Workshops",
      bio: "Leads delivery of physical intensive workshops in Blantyre and Lilongwe alongside bespoke research and 4IR trainings for ministries, NGOs, and corporate teams."
    }
  ],
  contact_address: "GIPT Campus, Lilongwe & Blantyre Training Centres, Malawi (www.gipt.edu.mw)",
  contact_phone_primary: "+265 885 921 221",
  contact_phone_secondary: "+265 885 921 221 (WhatsApp & Registration Desk)",
  contact_email_admissions: "info@gipt.edu.mw",
  contact_email_general: "info@gipt.edu.mw",
  office_hours: "Monday \u2013 Friday: 08:00 \u2013 17:00 CAT \xB7 Online Evening Classes: 18:00 \u2013 20:30 CAT \xB7 Physical Workshops: 08:00 \u2013 16:00 CAT",
  social_linkedin: "https://linkedin.com",
  social_twitter: "https://x.com",
  social_facebook: "https://facebook.com",
  social_youtube: "https://youtube.com",
  seo_default_title: "GIPT \u2014 Global Institute For Postgraduate Training | Research Mentorship & Short Courses",
  seo_default_description: "Global Institute For Postgraduate Training (GIPT) offers a Flagship Research Mentorship Programme, Research Methods short courses (Stata, NVivo, Excel, Proposal Writing), 4IR Skills trainings, and Free Information Sessions."
};

// server/store.ts
function stripPassword(u) {
  const { password_hash: _pw, ...safe } = u;
  return safe;
}
function getSeedAdminCredentials() {
  const email = (process.env.ADMIN_EMAIL || "admin@gipt.edu.mw").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@1234";
  return { email, password };
}
var MemoryStore = class {
  constructor() {
    this.mode = "memory";
    this.users = [];
    this.categories = [];
    this.posts = [];
    this.programs = [];
    this.resources = [];
    this.inquiries = [];
    this.subscribers = [];
    this.settings = structuredClone(INITIAL_SITE_SETTINGS);
    this.seq = {
      users: 1,
      categories: 1,
      posts: 1,
      programs: 1,
      resources: 1,
      inquiries: 1,
      subscribers: 1
    };
  }
  async init() {
    if (this.users.length > 0) return;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const adminCreds = getSeedAdminCredentials();
    const adminHash = await hashPassword(adminCreds.password);
    const editorHash = await hashPassword("Author@1234");
    this.users.push(
      {
        id: this.seq.users++,
        name: "Prof. Hastings Chikwanda",
        email: adminCreds.email,
        password_hash: adminHash,
        role: "super_admin",
        title: "Principal & Senior Policy Fellow",
        bio: "Development economist and Principal of GIPT specializing in public financial management, sovereign debt oversight, and regional higher education strategy.",
        avatar_url: "",
        created_at: now
      },
      {
        id: this.seq.users++,
        name: "Dr. Grace Nkhoma",
        email: "editor@gipt.edu.mw",
        password_hash: editorHash,
        role: "author",
        title: "Deputy Principal, Academic Affairs & Research",
        bio: "Higher education strategist and governance researcher overseeing curriculum innovation, blended executive pedagogy, and academic quality assurance.",
        avatar_url: "",
        created_at: now
      }
    );
    for (const c of INITIAL_CATEGORIES) {
      this.categories.push({ id: this.seq.categories++, ...c, created_at: now });
    }
    for (const p of INITIAL_PROGRAMS) {
      this.programs.push({ id: this.seq.programs++, ...p, created_at: now });
    }
    for (const r of INITIAL_RESOURCES) {
      this.resources.push({ id: this.seq.resources++, ...r, created_at: now });
    }
    for (const post of INITIAL_POSTS) {
      const cat = this.categories.find((c) => c.slug === post.category_slug);
      const author = this.users.find((u) => u.email === post.author_email) || this.users[0];
      this.posts.push({
        id: this.seq.posts++,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        cover_image: post.cover_image,
        category_id: cat ? cat.id : null,
        author_id: author.id,
        tags: post.tags,
        reading_time: calculateReadingTime(post.content),
        featured: post.featured,
        status: post.status,
        published_at: post.published_at,
        created_at: post.published_at,
        updated_at: post.published_at
      });
    }
    for (const inq of INITIAL_INQUIRIES) {
      this.inquiries.push({ id: this.seq.inquiries++, ...inq, created_at: now });
    }
    for (const sub of INITIAL_SUBSCRIBERS) {
      this.subscribers.push({ id: this.seq.subscribers++, ...sub, created_at: now });
    }
  }
  enrichPost(post) {
    const cat = this.categories.find((c) => c.id === post.category_id);
    const author = this.users.find((u) => u.id === post.author_id);
    return {
      ...post,
      category_name: cat?.name || "Uncategorized",
      category_slug: cat?.slug || "uncategorized",
      author_name: author?.name || "GIPT Editorial Desk",
      author_title: author?.title || "Faculty & Research",
      author_bio: author?.bio || ""
    };
  }
  async getUserByEmail(email) {
    const target = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === target) || null;
  }
  async getUserById(id) {
    return this.users.find((u) => u.id === id) || null;
  }
  async listUsers() {
    return this.users.map(stripPassword);
  }
  async createUser(data) {
    const user = {
      id: this.seq.users++,
      name: data.name,
      email: data.email.trim().toLowerCase(),
      password_hash: data.password_hash,
      role: data.role,
      title: data.title,
      bio: data.bio,
      avatar_url: data.avatar_url || "",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.users.push(user);
    return stripPassword(user);
  }
  async updateUser(id, data) {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    if (data.name !== void 0) user.name = data.name;
    if (data.email !== void 0) user.email = data.email.trim().toLowerCase();
    if (data.password_hash !== void 0) user.password_hash = data.password_hash;
    if (data.role !== void 0) user.role = data.role;
    if (data.title !== void 0) user.title = data.title;
    if (data.bio !== void 0) user.bio = data.bio;
    if (data.avatar_url !== void 0) user.avatar_url = data.avatar_url;
    return stripPassword(user);
  }
  async deleteUser(id) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }
  async listCategories() {
    return [...this.categories].sort((a, b) => a.name.localeCompare(b.name));
  }
  async createCategory(data) {
    const cat = {
      id: this.seq.categories++,
      name: data.name,
      slug: data.slug || slugify(data.name),
      description: data.description,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.categories.push(cat);
    return cat;
  }
  async updateCategory(id, data) {
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) return null;
    cat.name = data.name;
    cat.slug = data.slug || slugify(data.name);
    cat.description = data.description;
    return { ...cat };
  }
  async deleteCategory(id) {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.categories.splice(idx, 1);
    this.posts.forEach((p) => {
      if (p.category_id === id) p.category_id = null;
    });
    return true;
  }
  async listPosts(options) {
    let list = [...this.posts];
    if (options?.status && options.status !== "all") {
      list = list.filter((p) => p.status === options.status);
    }
    if (options?.authorId !== void 0) {
      list = list.filter((p) => p.author_id === options.authorId);
    }
    list.sort((a, b) => {
      const da = new Date(a.published_at || a.created_at).getTime();
      const db = new Date(b.published_at || b.created_at).getTime();
      return db - da;
    });
    return list.map((p) => this.enrichPost(p));
  }
  async getPostBySlug(slug) {
    const post = this.posts.find((p) => p.slug === slug);
    return post ? this.enrichPost(post) : null;
  }
  async getPostById(id) {
    const post = this.posts.find((p) => p.id === id);
    return post ? this.enrichPost(post) : null;
  }
  async createPost(data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let baseSlug = slugify(data.slug || data.title) || `post-${this.seq.posts}`;
    let finalSlug = baseSlug;
    let counter = 2;
    while (this.posts.some((p) => p.slug === finalSlug)) {
      finalSlug = `${baseSlug}-${counter++}`;
    }
    const post = {
      id: this.seq.posts++,
      ...data,
      slug: finalSlug,
      published_at: data.status === "published" ? data.published_at || now : null,
      created_at: now,
      updated_at: now
    };
    this.posts.push(post);
    return this.enrichPost(post);
  }
  async updatePost(id, data) {
    const post = this.posts.find((p) => p.id === id);
    if (!post) return null;
    if (data.slug !== void 0 && data.slug !== post.slug) {
      let baseSlug = slugify(data.slug || post.title) || `post-${post.id}`;
      let finalSlug = baseSlug;
      let counter = 2;
      while (this.posts.some((p) => p.id !== id && p.slug === finalSlug)) {
        finalSlug = `${baseSlug}-${counter++}`;
      }
      post.slug = finalSlug;
    }
    if (data.title !== void 0) post.title = data.title;
    if (data.excerpt !== void 0) post.excerpt = data.excerpt;
    if (data.content !== void 0) post.content = data.content;
    if (data.cover_image !== void 0) post.cover_image = data.cover_image;
    if (data.category_id !== void 0) post.category_id = data.category_id;
    if (data.tags !== void 0) post.tags = data.tags;
    if (data.reading_time !== void 0) post.reading_time = data.reading_time;
    if (data.featured !== void 0) post.featured = data.featured;
    if (data.status !== void 0) {
      post.status = data.status;
      if (data.status === "published" && !post.published_at) {
        post.published_at = data.published_at || (/* @__PURE__ */ new Date()).toISOString();
      } else if (data.status === "draft") {
        post.published_at = null;
      }
    }
    post.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    return this.enrichPost(post);
  }
  async deletePost(id) {
    const idx = this.posts.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.posts.splice(idx, 1);
    return true;
  }
  async listPrograms() {
    return [...this.programs];
  }
  async getProgramById(id) {
    return this.programs.find((p) => p.id === id) || null;
  }
  async createProgram(data) {
    const item = {
      id: this.seq.programs++,
      ...data,
      slug: data.slug || slugify(data.title),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.programs.push(item);
    return item;
  }
  async updateProgram(id, data) {
    const item = this.programs.find((p) => p.id === id);
    if (!item) return null;
    Object.assign(item, data);
    if (data.title && !data.slug) {
      item.slug = slugify(data.title);
    }
    return { ...item };
  }
  async deleteProgram(id) {
    const idx = this.programs.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.programs.splice(idx, 1);
    return true;
  }
  async listResources() {
    return [...this.resources];
  }
  async getResourceById(id) {
    return this.resources.find((r) => r.id === id) || null;
  }
  async createResource(data) {
    const id = this.seq.resources++;
    const item = {
      id,
      ...data,
      file_url: data.file_url || `/api/resources/${id}/download`,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.resources.push(item);
    return item;
  }
  async updateResource(id, data) {
    const item = this.resources.find((r) => r.id === id);
    if (!item) return null;
    Object.assign(item, data);
    return { ...item };
  }
  async deleteResource(id) {
    const idx = this.resources.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.resources.splice(idx, 1);
    return true;
  }
  async listInquiries() {
    return [...this.inquiries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  async createInquiry(data) {
    const item = {
      id: this.seq.inquiries++,
      ...data,
      status: "new",
      admin_notes: "",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.inquiries.unshift(item);
    return item;
  }
  async updateInquiry(id, data) {
    const item = this.inquiries.find((i) => i.id === id);
    if (!item) return null;
    if (data.status !== void 0) item.status = data.status;
    if (data.admin_notes !== void 0) item.admin_notes = data.admin_notes;
    return { ...item };
  }
  async deleteInquiry(id) {
    const idx = this.inquiries.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    this.inquiries.splice(idx, 1);
    return true;
  }
  async listSubscribers() {
    return [...this.subscribers].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  async addSubscriber(email) {
    const clean = email.trim().toLowerCase();
    const existing = this.subscribers.find((s) => s.email.toLowerCase() === clean);
    if (existing) {
      return { subscriber: existing, alreadyExists: true };
    }
    const sub = {
      id: this.seq.subscribers++,
      email: clean,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.subscribers.unshift(sub);
    return { subscriber: sub, alreadyExists: false };
  }
  async deleteSubscriber(id) {
    const idx = this.subscribers.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.subscribers.splice(idx, 1);
    return true;
  }
  async getSettings() {
    return structuredClone(this.settings);
  }
  async updateSettings(settings) {
    this.settings = structuredClone(settings);
    return structuredClone(this.settings);
  }
  async getDashboardStats() {
    return {
      published_posts: this.posts.filter((p) => p.status === "published").length,
      draft_posts: this.posts.filter((p) => p.status === "draft").length,
      total_programs: this.programs.length,
      total_resources: this.resources.length,
      new_inquiries: this.inquiries.filter((i) => i.status === "new").length,
      total_inquiries: this.inquiries.length,
      total_subscribers: this.subscribers.length,
      total_users: this.users.length
    };
  }
};
var MySQLStore = class {
  constructor() {
    this.mode = "mysql";
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4"
    });
  }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        email VARCHAR(190) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'author') NOT NULL DEFAULT 'author',
        title VARCHAR(190) NOT NULL DEFAULT '',
        bio TEXT NOT NULL,
        avatar_url VARCHAR(500) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(150) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        excerpt TEXT NOT NULL,
        content LONGTEXT NOT NULL,
        cover_image VARCHAR(500) NOT NULL DEFAULT '',
        category_id INT NULL,
        author_id INT NOT NULL,
        tags VARCHAR(500) NOT NULL DEFAULT '',
        reading_time INT NOT NULL DEFAULT 1,
        featured TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
        published_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_posts_status_pub (status, published_at),
        CONSTRAINT fk_posts_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS programs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        level ENUM('undergraduate', 'postgraduate', 'short_course') NOT NULL,
        faculty VARCHAR(190) NOT NULL DEFAULT '',
        duration VARCHAR(120) NOT NULL DEFAULT '',
        study_mode VARCHAR(160) NOT NULL DEFAULT '',
        entry_requirements TEXT NOT NULL,
        summary TEXT NOT NULL,
        highlights TEXT NOT NULL,
        intake VARCHAR(120) NOT NULL DEFAULT '',
        featured TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(120) NOT NULL,
        summary TEXT NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        publication_year VARCHAR(20) NOT NULL DEFAULT '2026',
        file_size VARCHAR(60) NOT NULL DEFAULT '1.0 MB PDF',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        email VARCHAR(190) NOT NULL,
        phone VARCHAR(80) NOT NULL DEFAULT '',
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        program_of_interest VARCHAR(255) NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        status ENUM('new', 'in_progress', 'resolved') NOT NULL DEFAULT 'new',
        admin_notes TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(190) NOT NULL UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await this.seedIfEmpty();
  }
  async seedIfEmpty() {
    const [userRows] = await this.pool.query("SELECT COUNT(*) AS cnt FROM users");
    if (Number(userRows[0]?.cnt || 0) === 0) {
      const adminCreds = getSeedAdminCredentials();
      const adminHash = await hashPassword(adminCreds.password);
      const editorHash = await hashPassword("Author@1234");
      await this.pool.query(
        "INSERT INTO users (name, email, password_hash, role, title, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "Prof. Hastings Chikwanda",
          adminCreds.email,
          adminHash,
          "super_admin",
          "Principal & Senior Policy Fellow",
          "Development economist and Principal of GIPT specializing in public financial management, sovereign debt oversight, and regional higher education strategy.",
          ""
        ]
      );
      await this.pool.query(
        "INSERT INTO users (name, email, password_hash, role, title, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "Dr. Grace Nkhoma",
          "editor@gipt.edu.mw",
          editorHash,
          "author",
          "Deputy Principal, Academic Affairs & Research",
          "Higher education strategist and governance researcher overseeing curriculum innovation, blended executive pedagogy, and academic quality assurance.",
          ""
        ]
      );
    }
    const [catRows] = await this.pool.query("SELECT COUNT(*) AS cnt FROM categories");
    if (Number(catRows[0]?.cnt || 0) === 0) {
      for (const c of INITIAL_CATEGORIES) {
        await this.pool.query(
          "INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)",
          [c.name, c.slug, c.description]
        );
      }
    }
    const [progRows] = await this.pool.query("SELECT COUNT(*) AS cnt FROM programs");
    if (Number(progRows[0]?.cnt || 0) === 0) {
      for (const p of INITIAL_PROGRAMS) {
        await this.pool.query(
          `INSERT INTO programs (title, slug, level, faculty, duration, study_mode, entry_requirements, summary, highlights, intake, featured)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.title,
            p.slug,
            p.level,
            p.faculty,
            p.duration,
            p.study_mode,
            p.entry_requirements,
            p.summary,
            p.highlights,
            p.intake,
            p.featured ? 1 : 0
          ]
        );
      }
    }
    const [resRows] = await this.pool.query("SELECT COUNT(*) AS cnt FROM resources");
    if (Number(resRows[0]?.cnt || 0) === 0) {
      for (const r of INITIAL_RESOURCES) {
        await this.pool.query(
          `INSERT INTO resources (title, category, summary, file_url, publication_year, file_size)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [r.title, r.category, r.summary, r.file_url, r.publication_year, r.file_size]
        );
      }
    }
    const [postRows] = await this.pool.query("SELECT COUNT(*) AS cnt FROM posts");
    if (Number(postRows[0]?.cnt || 0) === 0) {
      const cats = await this.listCategories();
      const users = await this.listUsers();
      for (const p of INITIAL_POSTS) {
        const cat = cats.find((c) => c.slug === p.category_slug);
        const author = users.find((u) => u.email === p.author_email) || users[0];
        if (!author) continue;
        await this.pool.query(
          `INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, author_id, tags, reading_time, featured, status, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.title,
            p.slug,
            p.excerpt,
            p.content,
            p.cover_image,
            cat ? cat.id : null,
            author.id,
            p.tags,
            calculateReadingTime(p.content),
            p.featured ? 1 : 0,
            p.status,
            new Date(p.published_at)
          ]
        );
      }
    }
    const [inqRows] = await this.pool.query("SELECT COUNT(*) AS cnt FROM inquiries");
    if (Number(inqRows[0]?.cnt || 0) === 0) {
      for (const inq of INITIAL_INQUIRIES) {
        await this.pool.query(
          `INSERT INTO inquiries (name, email, phone, category, program_of_interest, message, status, admin_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inq.name,
            inq.email,
            inq.phone,
            inq.category,
            inq.program_of_interest,
            inq.message,
            inq.status,
            inq.admin_notes
          ]
        );
      }
    }
    const [subRows] = await this.pool.query("SELECT COUNT(*) AS cnt FROM subscribers");
    if (Number(subRows[0]?.cnt || 0) === 0) {
      for (const sub of INITIAL_SUBSCRIBERS) {
        await this.pool.query("INSERT IGNORE INTO subscribers (email) VALUES (?)", [sub.email]);
      }
    }
    const [setRows] = await this.pool.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = ?",
      ["main"]
    );
    if (setRows.length === 0) {
      await this.pool.query(
        "INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)",
        ["main", JSON.stringify(INITIAL_SITE_SETTINGS)]
      );
    }
  }
  mapPost(row) {
    return {
      id: Number(row.id),
      title: String(row.title),
      slug: String(row.slug),
      excerpt: String(row.excerpt),
      content: String(row.content),
      cover_image: String(row.cover_image || ""),
      category_id: row.category_id ? Number(row.category_id) : null,
      category_name: row.category_name ? String(row.category_name) : "Uncategorized",
      category_slug: row.category_slug ? String(row.category_slug) : "uncategorized",
      author_id: Number(row.author_id),
      author_name: row.author_name ? String(row.author_name) : "GIPT Editorial Desk",
      author_title: row.author_title ? String(row.author_title) : "",
      author_bio: row.author_bio ? String(row.author_bio) : "",
      tags: String(row.tags || ""),
      reading_time: Number(row.reading_time || 1),
      featured: Boolean(row.featured),
      status: row.status,
      published_at: row.published_at ? new Date(row.published_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString()
    };
  }
  mapProgram(row) {
    return {
      id: Number(row.id),
      title: String(row.title),
      slug: String(row.slug),
      level: row.level,
      faculty: String(row.faculty || ""),
      duration: String(row.duration || ""),
      study_mode: String(row.study_mode || ""),
      entry_requirements: String(row.entry_requirements || ""),
      summary: String(row.summary || ""),
      highlights: String(row.highlights || ""),
      intake: String(row.intake || ""),
      featured: Boolean(row.featured),
      created_at: new Date(row.created_at).toISOString()
    };
  }
  async getUserByEmail(email) {
    const [rows] = await this.pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [email.trim()]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      password_hash: String(r.password_hash),
      role: r.role,
      title: String(r.title || ""),
      bio: String(r.bio || ""),
      avatar_url: String(r.avatar_url || ""),
      created_at: new Date(r.created_at).toISOString()
    };
  }
  async getUserById(id) {
    const [rows] = await this.pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      password_hash: String(r.password_hash),
      role: r.role,
      title: String(r.title || ""),
      bio: String(r.bio || ""),
      avatar_url: String(r.avatar_url || ""),
      created_at: new Date(r.created_at).toISOString()
    };
  }
  async listUsers() {
    const [rows] = await this.pool.query(
      "SELECT id, name, email, role, title, bio, avatar_url, created_at FROM users ORDER BY id ASC"
    );
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      role: r.role,
      title: String(r.title || ""),
      bio: String(r.bio || ""),
      avatar_url: String(r.avatar_url || ""),
      created_at: new Date(r.created_at).toISOString()
    }));
  }
  async createUser(data) {
    const [res] = await this.pool.query(
      "INSERT INTO users (name, email, password_hash, role, title, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [data.name, data.email.trim().toLowerCase(), data.password_hash, data.role, data.title, data.bio, data.avatar_url || ""]
    );
    const created = await this.getUserById(res.insertId);
    return stripPassword(created);
  }
  async updateUser(id, data) {
    const fields = [];
    const values = [];
    if (data.name !== void 0) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.email !== void 0) {
      fields.push("email = ?");
      values.push(data.email.trim().toLowerCase());
    }
    if (data.password_hash !== void 0) {
      fields.push("password_hash = ?");
      values.push(data.password_hash);
    }
    if (data.role !== void 0) {
      fields.push("role = ?");
      values.push(data.role);
    }
    if (data.title !== void 0) {
      fields.push("title = ?");
      values.push(data.title);
    }
    if (data.bio !== void 0) {
      fields.push("bio = ?");
      values.push(data.bio);
    }
    if (data.avatar_url !== void 0) {
      fields.push("avatar_url = ?");
      values.push(data.avatar_url);
    }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    const updated = await this.getUserById(id);
    return updated ? stripPassword(updated) : null;
  }
  async deleteUser(id) {
    const [res] = await this.pool.query("DELETE FROM users WHERE id = ?", [id]);
    return res.affectedRows > 0;
  }
  async listCategories() {
    const [rows] = await this.pool.query("SELECT * FROM categories ORDER BY name ASC");
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description || ""),
      created_at: new Date(r.created_at).toISOString()
    }));
  }
  async createCategory(data) {
    const finalSlug = data.slug || slugify(data.name);
    const [res] = await this.pool.query(
      "INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)",
      [data.name, finalSlug, data.description]
    );
    const [rows] = await this.pool.query("SELECT * FROM categories WHERE id = ?", [res.insertId]);
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description || ""),
      created_at: new Date(r.created_at).toISOString()
    };
  }
  async updateCategory(id, data) {
    const finalSlug = data.slug || slugify(data.name);
    await this.pool.query("UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?", [
      data.name,
      finalSlug,
      data.description,
      id
    ]);
    const [rows] = await this.pool.query("SELECT * FROM categories WHERE id = ?", [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description || ""),
      created_at: new Date(r.created_at).toISOString()
    };
  }
  async deleteCategory(id) {
    const [res] = await this.pool.query("DELETE FROM categories WHERE id = ?", [id]);
    return res.affectedRows > 0;
  }
  async listPosts(options) {
    const where = [];
    const params = [];
    if (options?.status && options.status !== "all") {
      where.push("p.status = ?");
      params.push(options.status);
    }
    if (options?.authorId !== void 0) {
      where.push("p.author_id = ?");
      params.push(options.authorId);
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await this.pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              u.name AS author_name, u.title AS author_title, u.bio AS author_bio
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
       ${whereClause}
       ORDER BY COALESCE(p.published_at, p.created_at) DESC`,
      params
    );
    return rows.map((r) => this.mapPost(r));
  }
  async getPostBySlug(slug) {
    const [rows] = await this.pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              u.name AS author_name, u.title AS author_title, u.bio AS author_bio
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.slug = ? LIMIT 1`,
      [slug]
    );
    return rows[0] ? this.mapPost(rows[0]) : null;
  }
  async getPostById(id) {
    const [rows] = await this.pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              u.name AS author_name, u.title AS author_title, u.bio AS author_bio
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ? this.mapPost(rows[0]) : null;
  }
  async ensureUniquePostSlug(base, excludeId) {
    let candidate = slugify(base) || `post-${Date.now()}`;
    let counter = 2;
    while (true) {
      const [rows] = await this.pool.query(
        excludeId ? "SELECT id FROM posts WHERE slug = ? AND id != ? LIMIT 1" : "SELECT id FROM posts WHERE slug = ? LIMIT 1",
        excludeId ? [candidate, excludeId] : [candidate]
      );
      if (rows.length === 0) return candidate;
      candidate = `${slugify(base)}-${counter++}`;
    }
  }
  async createPost(data) {
    const uniqueSlug = await this.ensureUniquePostSlug(data.slug || data.title);
    const pubAt = data.status === "published" ? new Date(data.published_at || Date.now()) : null;
    const [res] = await this.pool.query(
      `INSERT INTO posts (title, slug, excerpt, content, cover_image, category_id, author_id, tags, reading_time, featured, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        uniqueSlug,
        data.excerpt,
        data.content,
        data.cover_image,
        data.category_id,
        data.author_id,
        data.tags,
        data.reading_time,
        data.featured ? 1 : 0,
        data.status,
        pubAt
      ]
    );
    return await this.getPostById(res.insertId);
  }
  async updatePost(id, data) {
    const existing = await this.getPostById(id);
    if (!existing) return null;
    const fields = [];
    const values = [];
    if (data.title !== void 0) {
      fields.push("title = ?");
      values.push(data.title);
    }
    if (data.slug !== void 0 && data.slug !== existing.slug) {
      const uniqueSlug = await this.ensureUniquePostSlug(data.slug, id);
      fields.push("slug = ?");
      values.push(uniqueSlug);
    }
    if (data.excerpt !== void 0) {
      fields.push("excerpt = ?");
      values.push(data.excerpt);
    }
    if (data.content !== void 0) {
      fields.push("content = ?");
      values.push(data.content);
    }
    if (data.cover_image !== void 0) {
      fields.push("cover_image = ?");
      values.push(data.cover_image);
    }
    if (data.category_id !== void 0) {
      fields.push("category_id = ?");
      values.push(data.category_id);
    }
    if (data.tags !== void 0) {
      fields.push("tags = ?");
      values.push(data.tags);
    }
    if (data.reading_time !== void 0) {
      fields.push("reading_time = ?");
      values.push(data.reading_time);
    }
    if (data.featured !== void 0) {
      fields.push("featured = ?");
      values.push(data.featured ? 1 : 0);
    }
    if (data.status !== void 0) {
      fields.push("status = ?");
      values.push(data.status);
      if (data.status === "published" && !existing.published_at) {
        fields.push("published_at = ?");
        values.push(new Date(data.published_at || Date.now()));
      } else if (data.status === "draft") {
        fields.push("published_at = ?");
        values.push(null);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE posts SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    return this.getPostById(id);
  }
  async deletePost(id) {
    const [res] = await this.pool.query("DELETE FROM posts WHERE id = ?", [id]);
    return res.affectedRows > 0;
  }
  async listPrograms() {
    const [rows] = await this.pool.query("SELECT * FROM programs ORDER BY id ASC");
    return rows.map((r) => this.mapProgram(r));
  }
  async getProgramById(id) {
    const [rows] = await this.pool.query("SELECT * FROM programs WHERE id = ? LIMIT 1", [id]);
    return rows[0] ? this.mapProgram(rows[0]) : null;
  }
  async createProgram(data) {
    const finalSlug = `${slugify(data.slug || data.title)}-${Date.now().toString().slice(-4)}`;
    const [res] = await this.pool.query(
      `INSERT INTO programs (title, slug, level, faculty, duration, study_mode, entry_requirements, summary, highlights, intake, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        finalSlug,
        data.level,
        data.faculty,
        data.duration,
        data.study_mode,
        data.entry_requirements,
        data.summary,
        data.highlights,
        data.intake,
        data.featured ? 1 : 0
      ]
    );
    return await this.getProgramById(res.insertId);
  }
  async updateProgram(id, data) {
    const fields = [];
    const values = [];
    if (data.title !== void 0) {
      fields.push("title = ?");
      values.push(data.title);
    }
    if (data.level !== void 0) {
      fields.push("level = ?");
      values.push(data.level);
    }
    if (data.faculty !== void 0) {
      fields.push("faculty = ?");
      values.push(data.faculty);
    }
    if (data.duration !== void 0) {
      fields.push("duration = ?");
      values.push(data.duration);
    }
    if (data.study_mode !== void 0) {
      fields.push("study_mode = ?");
      values.push(data.study_mode);
    }
    if (data.entry_requirements !== void 0) {
      fields.push("entry_requirements = ?");
      values.push(data.entry_requirements);
    }
    if (data.summary !== void 0) {
      fields.push("summary = ?");
      values.push(data.summary);
    }
    if (data.highlights !== void 0) {
      fields.push("highlights = ?");
      values.push(data.highlights);
    }
    if (data.intake !== void 0) {
      fields.push("intake = ?");
      values.push(data.intake);
    }
    if (data.featured !== void 0) {
      fields.push("featured = ?");
      values.push(data.featured ? 1 : 0);
    }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE programs SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    return this.getProgramById(id);
  }
  async deleteProgram(id) {
    const [res] = await this.pool.query("DELETE FROM programs WHERE id = ?", [id]);
    return res.affectedRows > 0;
  }
  async listResources() {
    const [rows] = await this.pool.query("SELECT * FROM resources ORDER BY id DESC");
    return rows.map((r) => ({
      id: Number(r.id),
      title: String(r.title),
      category: String(r.category),
      summary: String(r.summary),
      file_url: String(r.file_url),
      publication_year: String(r.publication_year),
      file_size: String(r.file_size),
      created_at: new Date(r.created_at).toISOString()
    }));
  }
  async getResourceById(id) {
    const [rows] = await this.pool.query("SELECT * FROM resources WHERE id = ? LIMIT 1", [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      title: String(r.title),
      category: String(r.category),
      summary: String(r.summary),
      file_url: String(r.file_url),
      publication_year: String(r.publication_year),
      file_size: String(r.file_size),
      created_at: new Date(r.created_at).toISOString()
    };
  }
  async createResource(data) {
    const [res] = await this.pool.query(
      "INSERT INTO resources (title, category, summary, file_url, publication_year, file_size) VALUES (?, ?, ?, ?, ?, ?)",
      [data.title, data.category, data.summary, data.file_url || "", data.publication_year, data.file_size]
    );
    if (!data.file_url) {
      await this.pool.query("UPDATE resources SET file_url = ? WHERE id = ?", [
        `/api/resources/${res.insertId}/download`,
        res.insertId
      ]);
    }
    return await this.getResourceById(res.insertId);
  }
  async updateResource(id, data) {
    const fields = [];
    const values = [];
    if (data.title !== void 0) {
      fields.push("title = ?");
      values.push(data.title);
    }
    if (data.category !== void 0) {
      fields.push("category = ?");
      values.push(data.category);
    }
    if (data.summary !== void 0) {
      fields.push("summary = ?");
      values.push(data.summary);
    }
    if (data.file_url !== void 0) {
      fields.push("file_url = ?");
      values.push(data.file_url);
    }
    if (data.publication_year !== void 0) {
      fields.push("publication_year = ?");
      values.push(data.publication_year);
    }
    if (data.file_size !== void 0) {
      fields.push("file_size = ?");
      values.push(data.file_size);
    }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE resources SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    return this.getResourceById(id);
  }
  async deleteResource(id) {
    const [res] = await this.pool.query("DELETE FROM resources WHERE id = ?", [id]);
    return res.affectedRows > 0;
  }
  async listInquiries() {
    const [rows] = await this.pool.query("SELECT * FROM inquiries ORDER BY created_at DESC");
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      phone: String(r.phone || ""),
      category: String(r.category || "General"),
      program_of_interest: String(r.program_of_interest || ""),
      message: String(r.message || ""),
      status: r.status,
      admin_notes: String(r.admin_notes || ""),
      created_at: new Date(r.created_at).toISOString()
    }));
  }
  async createInquiry(data) {
    const [res] = await this.pool.query(
      `INSERT INTO inquiries (name, email, phone, category, program_of_interest, message, status, admin_notes)
       VALUES (?, ?, ?, ?, ?, ?, 'new', '')`,
      [data.name, data.email, data.phone, data.category, data.program_of_interest, data.message]
    );
    const [rows] = await this.pool.query("SELECT * FROM inquiries WHERE id = ?", [res.insertId]);
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      phone: String(r.phone || ""),
      category: String(r.category || "General"),
      program_of_interest: String(r.program_of_interest || ""),
      message: String(r.message || ""),
      status: r.status,
      admin_notes: String(r.admin_notes || ""),
      created_at: new Date(r.created_at).toISOString()
    };
  }
  async updateInquiry(id, data) {
    const fields = [];
    const values = [];
    if (data.status !== void 0) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.admin_notes !== void 0) {
      fields.push("admin_notes = ?");
      values.push(data.admin_notes);
    }
    if (fields.length > 0) {
      values.push(id);
      await this.pool.query(`UPDATE inquiries SET ${fields.join(", ")} WHERE id = ?`, values);
    }
    const [rows] = await this.pool.query("SELECT * FROM inquiries WHERE id = ?", [id]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      phone: String(r.phone || ""),
      category: String(r.category || "General"),
      program_of_interest: String(r.program_of_interest || ""),
      message: String(r.message || ""),
      status: r.status,
      admin_notes: String(r.admin_notes || ""),
      created_at: new Date(r.created_at).toISOString()
    };
  }
  async deleteInquiry(id) {
    const [res] = await this.pool.query("DELETE FROM inquiries WHERE id = ?", [id]);
    return res.affectedRows > 0;
  }
  async listSubscribers() {
    const [rows] = await this.pool.query("SELECT * FROM subscribers ORDER BY created_at DESC");
    return rows.map((r) => ({
      id: Number(r.id),
      email: String(r.email),
      created_at: new Date(r.created_at).toISOString()
    }));
  }
  async addSubscriber(email) {
    const clean = email.trim().toLowerCase();
    const [existing] = await this.pool.query(
      "SELECT * FROM subscribers WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [clean]
    );
    if (existing[0]) {
      return {
        subscriber: {
          id: Number(existing[0].id),
          email: String(existing[0].email),
          created_at: new Date(existing[0].created_at).toISOString()
        },
        alreadyExists: true
      };
    }
    const [res] = await this.pool.query(
      "INSERT INTO subscribers (email) VALUES (?)",
      [clean]
    );
    const [rows] = await this.pool.query("SELECT * FROM subscribers WHERE id = ?", [res.insertId]);
    return {
      subscriber: {
        id: Number(rows[0].id),
        email: String(rows[0].email),
        created_at: new Date(rows[0].created_at).toISOString()
      },
      alreadyExists: false
    };
  }
  async deleteSubscriber(id) {
    const [res] = await this.pool.query("DELETE FROM subscribers WHERE id = ?", [id]);
    return res.affectedRows > 0;
  }
  async getSettings() {
    const [rows] = await this.pool.query(
      "SELECT setting_value FROM site_settings WHERE setting_key = ?",
      ["main"]
    );
    if (!rows[0]) return structuredClone(INITIAL_SITE_SETTINGS);
    try {
      const parsed = JSON.parse(String(rows[0].setting_value));
      return { ...structuredClone(INITIAL_SITE_SETTINGS), ...parsed };
    } catch {
      return structuredClone(INITIAL_SITE_SETTINGS);
    }
  }
  async updateSettings(settings) {
    await this.pool.query(
      `INSERT INTO site_settings (setting_key, setting_value)
       VALUES ('main', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [JSON.stringify(settings)]
    );
    return this.getSettings();
  }
  async getDashboardStats() {
    const [[postStats]] = await this.pool.query(
      `SELECT
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_posts,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_posts
       FROM posts`
    );
    const [[progStats]] = await this.pool.query("SELECT COUNT(*) AS cnt FROM programs");
    const [[resStats]] = await this.pool.query("SELECT COUNT(*) AS cnt FROM resources");
    const [[inqStats]] = await this.pool.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_cnt FROM inquiries`
    );
    const [[subStats]] = await this.pool.query("SELECT COUNT(*) AS cnt FROM subscribers");
    const [[usrStats]] = await this.pool.query("SELECT COUNT(*) AS cnt FROM users");
    return {
      published_posts: Number(postStats?.published_posts || 0),
      draft_posts: Number(postStats?.draft_posts || 0),
      total_programs: Number(progStats?.cnt || 0),
      total_resources: Number(resStats?.cnt || 0),
      new_inquiries: Number(inqStats?.new_cnt || 0),
      total_inquiries: Number(inqStats?.total || 0),
      total_subscribers: Number(subStats?.cnt || 0),
      total_users: Number(usrStats?.cnt || 0)
    };
  }
};
async function createDataStore() {
  if (process.env.DB_HOST && process.env.DB_HOST.trim() !== "") {
    try {
      const mysqlStore = new MySQLStore();
      await mysqlStore.init();
      console.log("[GIPT] Connected to MySQL database and verified schema.");
      return mysqlStore;
    } catch (err) {
      console.error("[GIPT] MySQL connection failed, falling back to in-memory store:", err);
    }
  }
  const memoryStore = new MemoryStore();
  await memoryStore.init();
  console.log("[GIPT] Running with pre-populated in-memory store (DB_HOST unset).");
  return memoryStore;
}

// server.ts
var PORT = Number(process.env.PORT || 3e3);
var IS_PROD = process.env.NODE_ENV === "production";
var ROOT_DIR = process.cwd();
var UPLOADS_DIR = path.resolve(ROOT_DIR, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
var ALLOWED_UPLOAD_EXTS = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
var ALLOWED_UPLOAD_MIMES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);
var upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_UPLOAD_EXTS.has(ext) ? ext : ".bin";
      const token = crypto2.randomBytes(8).toString("hex");
      cb(null, `${Date.now()}-${token}${safeExt}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_EXTS.has(ext) && ALLOWED_UPLOAD_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WebP images and PDF files are permitted."));
    }
  }
});
function escapeHtmlText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
async function startServer() {
  const store = await createDataStore();
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.get("/uploads/:filename", (req, res) => {
    const rawName = path.basename(String(req.params.filename || ""));
    const resolved = path.resolve(UPLOADS_DIR, rawName);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: "File not found." });
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(resolved);
  });
  const requireAuth = async (req, res, next) => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const payload = verifyAuthToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired session." });
      return;
    }
    const user = await store.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: "User account not found." });
      return;
    }
    const { password_hash: _pw, ...safeUser } = user;
    req.user = safeUser;
    next();
  };
  const requireSuperAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== "super_admin") {
      res.status(403).json({ error: "Super Admin privileges required." });
      return;
    }
    next();
  };
  app.use("/api", verifyCsrfHeader);
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", storage: store.mode });
  });
  app.get("/api/settings", async (_req, res) => {
    const settings = await store.getSettings();
    res.json(settings);
  });
  app.get("/api/categories", async (_req, res) => {
    const categories = await store.listCategories();
    res.json(categories);
  });
  app.get("/api/posts", async (req, res) => {
    const posts = await store.listPosts({ status: "published" });
    const category = typeof req.query.category === "string" ? req.query.category.trim().toLowerCase() : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim().toLowerCase() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    let filtered = posts;
    if (category && category !== "all") {
      filtered = filtered.filter((p) => (p.category_slug || "").toLowerCase() === category);
    }
    if (tag) {
      filtered = filtered.filter(
        (p) => p.tags.split(",").map((t) => t.trim().toLowerCase()).includes(tag)
      );
    }
    if (q) {
      filtered = filtered.filter(
        (p) => `${p.title} ${p.excerpt} ${p.content} ${p.tags} ${p.author_name || ""}`.toLowerCase().includes(q)
      );
    }
    res.json(filtered);
  });
  app.get("/api/posts/:slug", async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    const post = await store.getPostBySlug(slug);
    if (!post || post.status !== "published") {
      res.status(404).json({ error: "Article not found." });
      return;
    }
    const allPublished = await store.listPosts({ status: "published" });
    const related = allPublished.filter((p) => p.id !== post.id).sort((a, b) => {
      const sameCatA = a.category_id === post.category_id ? 1 : 0;
      const sameCatB = b.category_id === post.category_id ? 1 : 0;
      return sameCatB - sameCatA;
    }).slice(0, 3);
    res.json({ post, related });
  });
  app.get("/api/programs", async (_req, res) => {
    const programs = await store.listPrograms();
    res.json(programs);
  });
  app.get("/api/resources", async (_req, res) => {
    const resources = await store.listResources();
    res.json(resources);
  });
  app.get("/api/resources/:id/download", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid resource ID." });
      return;
    }
    const resource = await store.getResourceById(id);
    if (!resource) {
      res.status(404).json({ error: "Publication not found." });
      return;
    }
    if (resource.file_url.startsWith("/uploads/")) {
      const safeName = path.basename(resource.file_url);
      const resolved = path.resolve(UPLOADS_DIR, safeName);
      if (resolved.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolved)) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.download(resolved, safeName);
        return;
      }
    }
    const settings = await store.getSettings();
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtmlText(resource.title)} \u2014 ${escapeHtmlText(settings.institute_short_name)}</title>
  <style>
    body { font-family: Georgia, serif; color: #181F29; max-width: 780px; margin: 48px auto; padding: 0 24px; line-height: 1.7; }
    .header { border-bottom: 2px solid #181F29; padding-bottom: 18px; margin-bottom: 28px; }
    .kicker { font-family: sans-serif; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #008398; font-weight: 600; }
    h1 { font-size: 28px; margin: 10px 0 8px; }
    .meta { font-family: sans-serif; font-size: 13px; color: #475569; }
    .summary { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px 24px; margin: 24px 0; }
    .footer { margin-top: 48px; border-top: 1px solid #CBD5E1; padding-top: 16px; font-family: sans-serif; font-size: 12px; color: #64748B; }
  </style>
</head>
<body>
  <div class="header">
    <div class="kicker">${escapeHtmlText(settings.institute_name)} \xB7 ${escapeHtmlText(resource.category)}</div>
    <h1>${escapeHtmlText(resource.title)}</h1>
    <div class="meta">Publication Year: ${escapeHtmlText(resource.publication_year)} \xB7 Format: ${escapeHtmlText(resource.file_size)}</div>
  </div>
  <div class="summary">
    <strong>Executive Overview</strong>
    <p>${escapeHtmlText(resource.summary)}</p>
  </div>
  <p>This official institutional document is published by the ${escapeHtmlText(settings.institute_name)} (${escapeHtmlText(settings.institute_short_name)}). For full printed prospectuses, certified syllabi, or institutional licensing inquiries, please contact the Office of Admissions and Academic Affairs.</p>
  <div class="footer">
    ${escapeHtmlText(settings.contact_address)} \xB7 ${escapeHtmlText(settings.contact_email_admissions)} \xB7 ${escapeHtmlText(settings.contact_phone_primary)}
  </div>
</body>
</html>`;
    const filename = `${slugify(resource.title) || "gipt-publication"}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.query.download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }
    res.send(html);
  });
  app.post("/api/subscribers", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    const { subscriber, alreadyExists } = await store.addSubscriber(email);
    res.status(alreadyExists ? 200 : 201).json({
      subscriber,
      alreadyExists,
      message: alreadyExists ? "This email address is already subscribed to GIPT intake alerts." : "Thank you for subscribing to GIPT intake alerts and research briefs."
    });
  });
  app.post("/api/inquiries", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const category = String(req.body?.category || "General").trim();
    const program_of_interest = String(req.body?.program_of_interest || "").trim();
    const message = String(req.body?.message || "").trim();
    if (name.length < 2) {
      res.status(400).json({ error: "Please provide your full name." });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Please provide a valid email address." });
      return;
    }
    if (message.length < 10) {
      res.status(400).json({ error: "Please enter a message of at least 10 characters." });
      return;
    }
    const inquiry = await store.createInquiry({
      name,
      email,
      phone,
      category,
      program_of_interest,
      message
    });
    res.status(201).json({
      inquiry,
      message: "Your inquiry has been received by the GIPT Admissions & Registry desk."
    });
  });
  app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    const user = await store.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    const token = signAuthToken({ userId: user.id, email: user.email, role: user.role });
    setAuthCookie(req, res, token);
    const { password_hash: _pw, ...safeUser } = user;
    res.json({ user: safeUser });
  });
  app.post("/api/auth/logout", (req, res) => {
    clearAuthCookie(req, res);
    res.json({ success: true });
  });
  app.get("/api/auth/me", async (req, res) => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      res.json({ user: null });
      return;
    }
    const payload = verifyAuthToken(token);
    if (!payload) {
      res.json({ user: null });
      return;
    }
    const user = await store.getUserById(payload.userId);
    if (!user) {
      res.json({ user: null });
      return;
    }
    const { password_hash: _pw, ...safeUser } = user;
    res.json({ user: safeUser });
  });
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    const stats = await store.getDashboardStats();
    if (req.user?.role === "author") {
      const ownPosts = await store.listPosts({ status: "all", authorId: req.user.id });
      res.json({
        ...stats,
        published_posts: ownPosts.filter((p) => p.status === "published").length,
        draft_posts: ownPosts.filter((p) => p.status === "draft").length
      });
      return;
    }
    res.json(stats);
  });
  app.post("/api/admin/upload", requireAuth, (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        res.status(400).json({ error: msg });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file provided." });
        return;
      }
      const sizeKb = req.file.size / 1024;
      const readableSize = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(sizeKb))} KB`;
      res.status(201).json({
        url: `/uploads/${req.file.filename}`,
        filename: req.file.filename,
        size: readableSize,
        mimetype: req.file.mimetype
      });
    });
  });
  app.put("/api/admin/profile", requireAuth, async (req, res) => {
    const userId = req.user.id;
    const name = String(req.body?.name || "").trim();
    const title = String(req.body?.title || "").trim();
    const bio = String(req.body?.bio || "").trim();
    const newPassword = String(req.body?.password || "");
    if (name.length < 2) {
      res.status(400).json({ error: "Name must be at least 2 characters." });
      return;
    }
    const updateData = { name, title, bio };
    if (newPassword) {
      if (newPassword.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters." });
        return;
      }
      updateData.password_hash = await hashPassword(newPassword);
    }
    const updated = await store.updateUser(userId, updateData);
    res.json({ user: updated });
  });
  app.get("/api/admin/posts", requireAuth, async (req, res) => {
    const isAuthor = req.user.role === "author";
    const posts = await store.listPosts({
      status: "all",
      authorId: isAuthor ? req.user.id : void 0
    });
    res.json(posts);
  });
  app.post("/api/admin/posts", requireAuth, async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const content = String(req.body?.content || "").trim();
    if (title.length < 3 || content.length < 10) {
      res.status(400).json({ error: "Title and article body content are required." });
      return;
    }
    const status = req.body?.status === "published" ? "published" : "draft";
    const cover = sanitizeUrl(String(req.body?.cover_image || ""));
    const categoryId = req.body?.category_id ? Number(req.body.category_id) : null;
    const featured = req.user.role === "super_admin" ? Boolean(req.body?.featured) : false;
    const created = await store.createPost({
      title,
      slug: String(req.body?.slug || slugify(title)),
      excerpt: String(req.body?.excerpt || "").trim() || content.slice(0, 180).trim(),
      content,
      cover_image: cover,
      category_id: categoryId,
      author_id: req.user.id,
      tags: String(req.body?.tags || "").trim(),
      reading_time: calculateReadingTime(content),
      featured,
      status,
      published_at: status === "published" ? (/* @__PURE__ */ new Date()).toISOString() : null
    });
    res.status(201).json(created);
  });
  app.put("/api/admin/posts/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await store.getPostById(id);
    if (!existing) {
      res.status(404).json({ error: "Post not found." });
      return;
    }
    if (req.user.role === "author" && existing.author_id !== req.user.id) {
      res.status(403).json({ error: "You may only edit your own articles." });
      return;
    }
    const title = req.body?.title !== void 0 ? String(req.body.title).trim() : existing.title;
    const content = req.body?.content !== void 0 ? String(req.body.content).trim() : existing.content;
    if (title.length < 3 || content.length < 10) {
      res.status(400).json({ error: "Title and article body content are required." });
      return;
    }
    const status = req.body?.status === "published" ? "published" : req.body?.status === "draft" ? "draft" : existing.status;
    const updated = await store.updatePost(id, {
      title,
      slug: req.body?.slug !== void 0 ? String(req.body.slug).trim() : existing.slug,
      excerpt: req.body?.excerpt !== void 0 ? String(req.body.excerpt).trim() : existing.excerpt,
      content,
      cover_image: req.body?.cover_image !== void 0 ? sanitizeUrl(String(req.body.cover_image)) : existing.cover_image,
      category_id: req.body?.category_id !== void 0 ? req.body.category_id ? Number(req.body.category_id) : null : existing.category_id,
      tags: req.body?.tags !== void 0 ? String(req.body.tags).trim() : existing.tags,
      reading_time: calculateReadingTime(content),
      featured: req.user.role === "super_admin" && req.body?.featured !== void 0 ? Boolean(req.body.featured) : existing.featured,
      status
    });
    res.json(updated);
  });
  app.delete("/api/admin/posts/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await store.getPostById(id);
    if (!existing) {
      res.status(404).json({ error: "Post not found." });
      return;
    }
    if (req.user.role === "author" && existing.author_id !== req.user.id) {
      res.status(403).json({ error: "You may only delete your own articles." });
      return;
    }
    await store.deletePost(id);
    res.json({ success: true });
  });
  app.post("/api/admin/categories", requireAuth, requireSuperAdmin, async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (name.length < 2) {
      res.status(400).json({ error: "Category name is required." });
      return;
    }
    const slug = slugify(String(req.body?.slug || name));
    const description = String(req.body?.description || "").trim();
    try {
      const created = await store.createCategory({ name, slug, description });
      res.status(201).json(created);
    } catch {
      res.status(400).json({ error: "A category with that slug already exists." });
    }
  });
  app.put("/api/admin/categories/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const name = String(req.body?.name || "").trim();
    if (name.length < 2) {
      res.status(400).json({ error: "Category name is required." });
      return;
    }
    const slug = slugify(String(req.body?.slug || name));
    const description = String(req.body?.description || "").trim();
    const updated = await store.updateCategory(id, { name, slug, description });
    if (!updated) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.json(updated);
  });
  app.delete("/api/admin/categories/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const ok = await store.deleteCategory(id);
    if (!ok) {
      res.status(404).json({ error: "Category not found." });
      return;
    }
    res.json({ success: true });
  });
  app.post("/api/admin/programs", requireAuth, requireSuperAdmin, async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const level = req.body?.level;
    if (title.length < 3 || !["undergraduate", "postgraduate", "short_course"].includes(level)) {
      res.status(400).json({ error: "Valid program title and academic level are required." });
      return;
    }
    const created = await store.createProgram({
      title,
      slug: slugify(String(req.body?.slug || title)),
      level,
      faculty: String(req.body?.faculty || "").trim(),
      duration: String(req.body?.duration || "").trim(),
      study_mode: String(req.body?.study_mode || "").trim(),
      entry_requirements: String(req.body?.entry_requirements || "").trim(),
      summary: String(req.body?.summary || "").trim(),
      highlights: String(req.body?.highlights || "").trim(),
      intake: String(req.body?.intake || "").trim(),
      featured: Boolean(req.body?.featured)
    });
    res.status(201).json(created);
  });
  app.put("/api/admin/programs/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await store.updateProgram(id, {
      title: req.body?.title !== void 0 ? String(req.body.title).trim() : void 0,
      level: req.body?.level,
      faculty: req.body?.faculty !== void 0 ? String(req.body.faculty).trim() : void 0,
      duration: req.body?.duration !== void 0 ? String(req.body.duration).trim() : void 0,
      study_mode: req.body?.study_mode !== void 0 ? String(req.body.study_mode).trim() : void 0,
      entry_requirements: req.body?.entry_requirements !== void 0 ? String(req.body.entry_requirements).trim() : void 0,
      summary: req.body?.summary !== void 0 ? String(req.body.summary).trim() : void 0,
      highlights: req.body?.highlights !== void 0 ? String(req.body.highlights).trim() : void 0,
      intake: req.body?.intake !== void 0 ? String(req.body.intake).trim() : void 0,
      featured: req.body?.featured !== void 0 ? Boolean(req.body.featured) : void 0
    });
    if (!updated) {
      res.status(404).json({ error: "Program not found." });
      return;
    }
    res.json(updated);
  });
  app.delete("/api/admin/programs/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteProgram(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Program not found." });
      return;
    }
    res.json({ success: true });
  });
  app.post("/api/admin/resources", requireAuth, requireSuperAdmin, async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const category = String(req.body?.category || "").trim();
    if (title.length < 3 || !category) {
      res.status(400).json({ error: "Publication title and category are required." });
      return;
    }
    const created = await store.createResource({
      title,
      category,
      summary: String(req.body?.summary || "").trim(),
      file_url: sanitizeUrl(String(req.body?.file_url || "")),
      publication_year: String(req.body?.publication_year || (/* @__PURE__ */ new Date()).getFullYear()).trim(),
      file_size: String(req.body?.file_size || "1.0 MB PDF").trim()
    });
    res.status(201).json(created);
  });
  app.put("/api/admin/resources/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await store.updateResource(id, {
      title: req.body?.title !== void 0 ? String(req.body.title).trim() : void 0,
      category: req.body?.category !== void 0 ? String(req.body.category).trim() : void 0,
      summary: req.body?.summary !== void 0 ? String(req.body.summary).trim() : void 0,
      file_url: req.body?.file_url !== void 0 ? sanitizeUrl(String(req.body.file_url)) : void 0,
      publication_year: req.body?.publication_year !== void 0 ? String(req.body.publication_year).trim() : void 0,
      file_size: req.body?.file_size !== void 0 ? String(req.body.file_size).trim() : void 0
    });
    if (!updated) {
      res.status(404).json({ error: "Publication not found." });
      return;
    }
    res.json(updated);
  });
  app.delete("/api/admin/resources/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteResource(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Publication not found." });
      return;
    }
    res.json({ success: true });
  });
  app.get("/api/admin/inquiries", requireAuth, requireSuperAdmin, async (_req, res) => {
    res.json(await store.listInquiries());
  });
  app.put("/api/admin/inquiries/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (status && !["new", "in_progress", "resolved"].includes(status)) {
      res.status(400).json({ error: "Invalid inquiry status." });
      return;
    }
    const updated = await store.updateInquiry(id, {
      status,
      admin_notes: req.body?.admin_notes !== void 0 ? String(req.body.admin_notes).trim() : void 0
    });
    if (!updated) {
      res.status(404).json({ error: "Inquiry not found." });
      return;
    }
    res.json(updated);
  });
  app.delete("/api/admin/inquiries/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteInquiry(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Inquiry not found." });
      return;
    }
    res.json({ success: true });
  });
  app.get("/api/admin/subscribers", requireAuth, requireSuperAdmin, async (_req, res) => {
    res.json(await store.listSubscribers());
  });
  app.delete("/api/admin/subscribers/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const ok = await store.deleteSubscriber(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Subscriber not found." });
      return;
    }
    res.json({ success: true });
  });
  app.get("/api/admin/users", requireAuth, requireSuperAdmin, async (_req, res) => {
    res.json(await store.listUsers());
  });
  app.post("/api/admin/users", requireAuth, requireSuperAdmin, async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = req.body?.role === "super_admin" ? "super_admin" : "author";
    const title = String(req.body?.title || "").trim();
    const bio = String(req.body?.bio || "").trim();
    if (name.length < 2 || !isValidEmail(email) || password.length < 8) {
      res.status(400).json({ error: "Valid name, email, and password (min 8 characters) are required." });
      return;
    }
    const existing = await store.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    const password_hash = await hashPassword(password);
    const created = await store.createUser({ name, email, password_hash, role, title, bio });
    res.status(201).json(created);
  });
  app.put("/api/admin/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updateData = {};
    if (req.body?.name !== void 0) updateData.name = String(req.body.name).trim();
    if (req.body?.email !== void 0) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!isValidEmail(email)) {
        res.status(400).json({ error: "Valid email is required." });
        return;
      }
      updateData.email = email;
    }
    if (req.body?.role === "super_admin" || req.body?.role === "author") {
      updateData.role = req.body.role;
    }
    if (req.body?.title !== void 0) updateData.title = String(req.body.title).trim();
    if (req.body?.bio !== void 0) updateData.bio = String(req.body.bio).trim();
    if (req.body?.password) {
      const pw = String(req.body.password);
      if (pw.length < 8) {
        res.status(400).json({ error: "Password must be at least 8 characters." });
        return;
      }
      updateData.password_hash = await hashPassword(pw);
    }
    const updated = await store.updateUser(id, updateData);
    if (!updated) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json(updated);
  });
  app.delete("/api/admin/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      res.status(400).json({ error: "You cannot delete your own active account." });
      return;
    }
    const ok = await store.deleteUser(id);
    if (!ok) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json({ success: true });
  });
  app.put("/api/admin/settings", requireAuth, requireSuperAdmin, async (req, res) => {
    const current = await store.getSettings();
    const incoming = req.body;
    const sanitizedSlides = Array.isArray(incoming.hero_slides) ? incoming.hero_slides.map((s) => ({
      ...s,
      image_url: sanitizeUrl(s.image_url),
      primary_cta_link: sanitizeUrl(s.primary_cta_link) || "/programs",
      secondary_cta_link: sanitizeUrl(s.secondary_cta_link) || "/#knowledge-hub"
    })) : current.hero_slides;
    const merged = {
      ...current,
      ...incoming,
      hero_slides: sanitizedSlides,
      logo_url: incoming.logo_url !== void 0 ? sanitizeUrl(incoming.logo_url) : current.logo_url,
      announcement_link_url: incoming.announcement_link_url !== void 0 ? sanitizeUrl(incoming.announcement_link_url) || "/programs" : current.announcement_link_url,
      social_linkedin: incoming.social_linkedin !== void 0 ? sanitizeUrl(incoming.social_linkedin) : current.social_linkedin,
      social_twitter: incoming.social_twitter !== void 0 ? sanitizeUrl(incoming.social_twitter) : current.social_twitter,
      social_facebook: incoming.social_facebook !== void 0 ? sanitizeUrl(incoming.social_facebook) : current.social_facebook,
      social_youtube: incoming.social_youtube !== void 0 ? sanitizeUrl(incoming.social_youtube) : current.social_youtube
    };
    const updated = await store.updateSettings(merged);
    res.json(updated);
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GIPT] Server running on http://0.0.0.0:${PORT} (${IS_PROD ? "production" : "development"})`);
  });
}
startServer().catch((err) => {
  console.error("[GIPT] Failed to start server:", err);
  process.exit(1);
});
