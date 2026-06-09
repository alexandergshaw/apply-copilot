export type JobStatus = "new" | "review" | "applied" | "rejected";

export type AutoApplyStatus =
  | "not_requested"
  | "queued"
  | "running"
  | "needs_review"
  | "submitted"
  | "failed"
  | "blocked"
  | "canceled";

export type Job = {
  id: string;
  company: string;
  role: string;
  location: string;
  source: string;
  sourceType: string;
  sourceId: string;
  status: JobStatus;
  matchScore: number;
  postedDate: string;
  description: string;
  applyUrl: string | null;
  matchReason: string;
  riskNotes: string;
  tailoredResumeDraft: string;
  coverLetterDraft: string;
  shortAnswerDrafts: string[];
  autoApplyEnabled: boolean;
  autoApplyStatus: AutoApplyStatus;
  autoApplyApprovedAt: string;
  autoApplyError: string;
};

export type AutoApplyRun = {
  id: string;
  jobId: string;
  status: AutoApplyStatus;
  startedAt: string;
  finishedAt: string;
  errorMessage: string;
  createdAt: string;
};

export type ApplicationStatus = "draft" | "submitted" | "interview" | "offer" | "rejected";

export type Application = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedDate: string;
  followUpDate: string;
  notes: string;
};

export type Profile = {
  name: string;
  targetTitles: string;
  targetLocations: string;
  minimumSalary: string;
  remotePreference: "remote" | "hybrid" | "onsite";
  skills: string;
  resumeText: string;
};

export type SourceType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "manual"
  | "url"
  | "job board"
  | "company"
  | "recruiter"
  | "referral";

export type JobSource = {
  id: string;
  sourceName: string;
  sourceType: SourceType;
  url: string;
  companyName: string;
  companySlug: string;
  fetchIntervalMinutes: number | null;
  remoteOnly: boolean;
  postedWithinDays: number;
  enabled: boolean;
  lastRunAt: string;
  lastAutoRunAt: string;
  lastSuccessAt: string;
  lastError: string;
  runCount: number;
};

export const jobs: Job[] = [
  {
    id: "job-101",
    company: "Northstar Health",
    role: "Senior Product Manager",
    location: "Remote (US)",
    source: "LinkedIn",
    sourceType: "job board",
    sourceId: "source-1",
    status: "review",
    matchScore: 91,
    postedDate: "2026-06-03",
    description:
      "Lead roadmap execution for patient scheduling and care coordination products across web and mobile surfaces.",
    applyUrl: "https://example.com/northstar-health/senior-product-manager",
    matchReason:
      "Strong overlap with healthcare workflow optimization, analytics-driven prioritization, and cross-functional leadership experience.",
    riskNotes:
      "Role asks for prior payer-side domain expertise. Resume currently emphasizes provider-side work.",
    tailoredResumeDraft:
      "Highlight outcomes: reduced no-show rate 28%, launched automated care reminders, and improved clinician NPS.",
    coverLetterDraft:
      "I'm excited to bring my background in patient experience and workflow systems to Northstar Health's product organization.",
    shortAnswerDrafts: [
      "Why this role: mission and measurable impact in care delivery.",
      "Leadership style: context-first planning and rapid feedback loops.",
    ],
    autoApplyEnabled: false,
    autoApplyStatus: "not_requested",
    autoApplyApprovedAt: "",
    autoApplyError: "",
  },
  {
    id: "job-102",
    company: "Cloudline",
    role: "Staff Product Manager, AI Platform",
    location: "San Francisco, CA",
    source: "Greenhouse",
    sourceType: "greenhouse",
    sourceId: "source-2",
    status: "new",
    matchScore: 84,
    postedDate: "2026-06-05",
    description:
      "Own platform strategy for internal AI tooling, experimentation frameworks, and developer enablement.",
    applyUrl: "https://example.com/cloudline/staff-product-manager-ai-platform",
    matchReason:
      "Deep fit with platform product background and prior experience shipping internal enablement tooling.",
    riskNotes:
      "Onsite expectation may conflict with preferred hybrid/remote constraints.",
    tailoredResumeDraft:
      "Emphasize API platform ownership and successful launch of experimentation dashboards used by 200+ engineers.",
    coverLetterDraft:
      "Your focus on developer velocity through applied AI closely aligns with the work I've led in platform teams.",
    shortAnswerDrafts: [
      "Greatest platform launch: analytics pipeline migration with zero downtime.",
      "AI governance: partner with legal/security early and measure model quality continually.",
    ],
    autoApplyEnabled: false,
    autoApplyStatus: "not_requested",
    autoApplyApprovedAt: "",
    autoApplyError: "",
  },
  {
    id: "job-103",
    company: "Blue Oak Labs",
    role: "Principal Product Manager",
    location: "Austin, TX",
    source: "Lever",
    sourceType: "lever",
    sourceId: "source-3",
    status: "applied",
    matchScore: 88,
    postedDate: "2026-05-30",
    description:
      "Drive product strategy for B2B workflow automation products and enterprise integrations.",
    applyUrl: "https://example.com/blue-oak-labs/principal-product-manager",
    matchReason:
      "Strong enterprise SaaS and automation experience with customer discovery and GTM collaboration.",
    riskNotes:
      "Compensation range not listed; verify alignment with salary floor.",
    tailoredResumeDraft:
      "Lead with enterprise expansion metrics and successful rollout of multi-tenant workflow orchestration.",
    coverLetterDraft:
      "I thrive in ambiguous, high-impact product spaces and would bring a strong operator mindset to Blue Oak Labs.",
    shortAnswerDrafts: [
      "Cross-functional execution example: launch across Product, Eng, Sales Enablement.",
      "Customer research approach: weekly customer interviews + usage instrumentation.",
    ],
    autoApplyEnabled: false,
    autoApplyStatus: "not_requested",
    autoApplyApprovedAt: "",
    autoApplyError: "",
  },
  {
    id: "job-104",
    company: "Verdant Systems",
    role: "Product Lead",
    location: "New York, NY",
    source: "Indeed",
    sourceType: "job board",
    sourceId: "",
    status: "rejected",
    matchScore: 62,
    postedDate: "2026-05-28",
    description:
      "Lead B2C growth experimentation and subscription funnel optimization.",
    applyUrl: null,
    matchReason:
      "Relevant growth work, but limited direct subscription-pricing ownership compared with role requirements.",
    riskNotes:
      "Core requirement is 8+ years in direct-to-consumer growth; profile is stronger in B2B and marketplace contexts.",
    tailoredResumeDraft:
      "If revisited, foreground lifecycle experiments and pricing collaboration metrics.",
    coverLetterDraft:
      "Thank you for considering my background and accomplishments in experimentation-led product work.",
    shortAnswerDrafts: [
      "Growth metric ownership examples.",
      "Pricing experiment framework with guardrails.",
    ],
    autoApplyEnabled: false,
    autoApplyStatus: "not_requested",
    autoApplyApprovedAt: "",
    autoApplyError: "",
  },
];

export const autoApplyRuns: AutoApplyRun[] = [];

export const applications: Application[] = [
  {
    id: "app-1",
    company: "Blue Oak Labs",
    role: "Principal Product Manager",
    status: "submitted",
    appliedDate: "2026-06-01",
    followUpDate: "2026-06-10",
    notes: "Recruiter acknowledged receipt and will share timeline this week.",
  },
  {
    id: "app-2",
    company: "Northstar Health",
    role: "Senior Product Manager",
    status: "draft",
    appliedDate: "",
    followUpDate: "2026-06-12",
    notes: "Waiting for final review of tailored resume and cover letter.",
  },
  {
    id: "app-3",
    company: "Cloudline",
    role: "Staff Product Manager, AI Platform",
    status: "interview",
    appliedDate: "2026-05-24",
    followUpDate: "2026-06-11",
    notes: "Phone screen completed; onsite scheduling in progress.",
  },
];

export const profile: Profile = {
  name: "Alex Shaw",
  targetTitles: "Senior Product Manager, Principal Product Manager",
  targetLocations: "Remote (US), Austin, TX",
  minimumSalary: "185000",
  remotePreference: "remote",
  skills: "Product strategy, roadmap planning, experimentation, stakeholder alignment, healthcare workflows",
  resumeText:
    "Product leader with 10+ years building workflow, analytics, and automation products. Experienced in cross-functional execution and measurable business outcomes.",
};

export const jobSources: JobSource[] = [
  {
    id: "source-1",
    sourceName: "LinkedIn Saved Search",
    sourceType: "job board",
    url: "https://www.linkedin.com/jobs/",
    companyName: "",
    companySlug: "",
    fetchIntervalMinutes: null,
    remoteOnly: true,
    postedWithinDays: 1,
    enabled: true,
    lastRunAt: "",
    lastAutoRunAt: "",
    lastSuccessAt: "",
    lastError: "",
    runCount: 0,
  },
  {
    id: "source-2",
    sourceName: "Greenhouse - Product Roles",
    sourceType: "greenhouse",
    url: "https://boards.greenhouse.io/example",
    companyName: "Example Greenhouse Company",
    companySlug: "example",
    fetchIntervalMinutes: null,
    remoteOnly: true,
    postedWithinDays: 1,
    enabled: false,
    lastRunAt: "",
    lastAutoRunAt: "",
    lastSuccessAt: "",
    lastError: "",
    runCount: 0,
  },
  {
    id: "source-3",
    sourceName: "Recruiter Digest",
    sourceType: "recruiter",
    url: "https://example.com/recruiter-digest",
    companyName: "",
    companySlug: "",
    fetchIntervalMinutes: null,
    remoteOnly: true,
    postedWithinDays: 1,
    enabled: false,
    lastRunAt: "",
    lastAutoRunAt: "",
    lastSuccessAt: "",
    lastError: "",
    runCount: 0,
  },
];
