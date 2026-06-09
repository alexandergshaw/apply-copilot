// Database row types matching supabase/migrations and helpers to map Supabase
// rows onto UI-facing domain types.

import type {
  Application,
  ApplicationStatus,
  AutoApplyRun,
  AutoApplyStatus,
  Job,
  JobSource,
  JobStatus,
  SourceType,
} from "@/lib/mock-data";

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  targetTitles: string[];
  targetLocations: string[];
  minSalary: number | null;
  remotePreference: string;
  skills: string[];
  resumeText: string;
  summary: string;
  workHistory: unknown[];
  education: unknown[];
  certifications: unknown[];
  projects: unknown[];
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ResumeVersion = {
  id: number;
  profileId: string;
  name: string;
  targetRole: string;
  resumeText: string;
  resumeJson: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ResumeTemplate = {
  id: number;
  profileId: string;
  name: string;
  targetRole: string;
  originalFilename: string;
  docxStoragePath: string;
  extractedText: string;
  templateText: string;
  templateJson: Record<string, unknown>;
  uploadSource: "docx" | "manual";
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TailoredResume = {
  id: number;
  jobId: number | null;
  resumeTemplateId: number | null;
  status: "draft" | "reviewed" | "approved" | "rejected" | "stale";
  tailoredText: string;
  tailoringNotes: string;
  keywordCoverage: Record<string, unknown>;
  matchScore: number | null;
  outputFilename: string;
  outputDocxStoragePath: string;
  sourceDocxStoragePath: string;
  createdAt: string;
  updatedAt: string;
};

export type UserProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  target_titles: string[] | null;
  target_locations: string[] | null;
  min_salary: number | null;
  remote_preference: string | null;
  skills: string[] | null;
  resume_text: string | null;
  summary: string | null;
  work_history: unknown;
  education: unknown;
  certifications: unknown;
  projects: unknown;
  preferences: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export type ResumeVersionRow = {
  id: number;
  profile_id: string;
  name: string;
  target_role: string | null;
  resume_text: string;
  resume_json: unknown;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ResumeTemplateRow = {
  id: number;
  profile_id: string;
  name: string;
  target_role: string | null;
  original_filename: string | null;
  docx_storage_path: string | null;
  extracted_text: string | null;
  template_text: string | null;
  template_json: unknown;
  upload_source: string | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TailoredResumeRow = {
  id: number;
  job_id: number | null;
  resume_template_id: number | null;
  status: string | null;
  tailored_text: string;
  tailoring_notes: string | null;
  keyword_coverage: unknown;
  match_score: number | null;
  output_filename: string | null;
  output_docx_storage_path: string | null;
  source_docx_storage_path: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type JobSourceRow = {
  id: number;
  name: string;
  source_type: string;
  url: string;
  company_name: string | null;
  company_slug: string | null;
  enabled: boolean | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  run_count: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type JobFetchRunRow = {
  id: number;
  source_id: number | null;
  source_type: string;
  status: string | null;
  jobs_found: number | null;
  jobs_inserted: number | null;
  jobs_updated: number | null;
  jobs_skipped: number | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
};

export type JobRow = {
  id: number;
  source_id: number | null;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  apply_url: string | null;
  status: string | null;
  match_score: number | null;
  match_reason: string | null;
  auto_apply_enabled: boolean | null;
  auto_apply_approved_at: string | null;
  auto_apply_status: string | null;
  auto_apply_error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AutoApplyRunRow = {
  id: number;
  job_id: number | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  run_log: unknown;
  created_at: string | null;
  updated_at: string | null;
};

export type ApplicationPacketRow = {
  id: number;
  job_id: number | null;
  tailored_resume: string | null;
  tailoring_notes: string | null;
  cover_letter: string | null;
  short_answers: unknown;
  risk_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ApplicationRow = {
  id: number;
  job_id: number | null;
  packet_id: number | null;
  status: string | null;
  applied_at: string | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow>;
        Update: Partial<UserProfileRow>;
        Relationships: [];
      };
      resume_versions: {
        Row: ResumeVersionRow;
        Insert: Partial<ResumeVersionRow>;
        Update: Partial<ResumeVersionRow>;
        Relationships: [
          {
            foreignKeyName: "resume_versions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      resume_templates: {
        Row: ResumeTemplateRow;
        Insert: Partial<ResumeTemplateRow>;
        Update: Partial<ResumeTemplateRow>;
        Relationships: [
          {
            foreignKeyName: "resume_templates_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tailored_resumes: {
        Row: TailoredResumeRow;
        Insert: Partial<TailoredResumeRow>;
        Update: Partial<TailoredResumeRow>;
        Relationships: [
          {
            foreignKeyName: "tailored_resumes_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tailored_resumes_resume_template_id_fkey";
            columns: ["resume_template_id"];
            isOneToOne: false;
            referencedRelation: "resume_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      job_sources: {
        Row: JobSourceRow;
        Insert: Partial<JobSourceRow>;
        Update: Partial<JobSourceRow>;
        Relationships: [];
      };
      job_fetch_runs: {
        Row: JobFetchRunRow;
        Insert: Partial<JobFetchRunRow>;
        Update: Partial<JobFetchRunRow>;
        Relationships: [
          {
            foreignKeyName: "job_fetch_runs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "job_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: JobRow;
        Insert: Partial<JobRow>;
        Update: Partial<JobRow>;
        Relationships: [
          {
            foreignKeyName: "jobs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "job_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      application_packets: {
        Row: ApplicationPacketRow;
        Insert: Partial<ApplicationPacketRow>;
        Update: Partial<ApplicationPacketRow>;
        Relationships: [
          {
            foreignKeyName: "application_packets_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: ApplicationRow;
        Insert: Partial<ApplicationRow>;
        Update: Partial<ApplicationRow>;
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_packet_id_fkey";
            columns: ["packet_id"];
            isOneToOne: false;
            referencedRelation: "application_packets";
            referencedColumns: ["id"];
          },
        ];
      };
      auto_apply_runs: {
        Row: AutoApplyRunRow;
        Insert: Partial<AutoApplyRunRow>;
        Update: Partial<AutoApplyRunRow>;
        Relationships: [
          {
            foreignKeyName: "auto_apply_runs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

function toListString(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

const JOB_STATUSES: JobStatus[] = ["new", "review", "applied", "rejected"];
const AUTO_APPLY_STATUSES: AutoApplyStatus[] = [
  "not_requested",
  "queued",
  "running",
  "needs_review",
  "submitted",
  "failed",
  "blocked",
  "canceled",
];

export function mapJobStatus(status: string | null | undefined): JobStatus {
  if (status === "found") {
    return "new";
  }
  if (status === "saved") {
    return "review";
  }
  return (JOB_STATUSES as string[]).includes(status ?? "") ? (status as JobStatus) : "new";
}

export function mapAutoApplyStatus(status: string | null | undefined): AutoApplyStatus {
  return (AUTO_APPLY_STATUSES as string[]).includes(status ?? "")
    ? (status as AutoApplyStatus)
    : "not_requested";
}

const APPLICATION_STATUSES: ApplicationStatus[] = [
  "draft",
  "submitted",
  "interview",
  "offer",
  "rejected",
];

export function mapApplicationStatus(status: string | null | undefined): ApplicationStatus {
  if (status === "review") {
    return "draft";
  }
  return (APPLICATION_STATUSES as string[]).includes(status ?? "")
    ? (status as ApplicationStatus)
    : "draft";
}

function mapSourceType(sourceType: string | null | undefined): SourceType {
  const allowed: SourceType[] = [
    "greenhouse",
    "lever",
    "ashby",
    "manual",
    "url",
    "job board",
    "company",
    "recruiter",
    "referral",
  ];
  return (allowed as string[]).includes(sourceType ?? "")
    ? (sourceType as SourceType)
    : "manual";
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function parseShortAnswers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toDateString(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

function toISOStringOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

export function mapUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    location: row.location ?? "",
    linkedinUrl: row.linkedin_url ?? "",
    portfolioUrl: row.portfolio_url ?? "",
    githubUrl: row.github_url ?? "",
    targetTitles: row.target_titles ?? [],
    targetLocations: row.target_locations ?? [],
    minSalary: row.min_salary,
    remotePreference: row.remote_preference ?? "remote",
    skills: row.skills ?? [],
    resumeText: row.resume_text ?? "",
    summary: row.summary ?? "",
    workHistory: parseJsonArray(row.work_history),
    education: parseJsonArray(row.education),
    certifications: parseJsonArray(row.certifications),
    projects: parseJsonArray(row.projects),
    preferences: parseJsonObject(row.preferences),
    createdAt: toISOStringOrEmpty(row.created_at),
    updatedAt: toISOStringOrEmpty(row.updated_at),
  };
}

export function mapResumeVersion(row: ResumeVersionRow): ResumeVersion {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    targetRole: row.target_role ?? "",
    resumeText: row.resume_text,
    resumeJson: parseJsonObject(row.resume_json),
    isDefault: row.is_default ?? false,
    createdAt: toISOStringOrEmpty(row.created_at),
    updatedAt: toISOStringOrEmpty(row.updated_at),
  };
}

export function mapResumeTemplate(row: ResumeTemplateRow): ResumeTemplate {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    targetRole: row.target_role ?? "",
    originalFilename: row.original_filename ?? "",
    docxStoragePath: row.docx_storage_path ?? "",
    extractedText: row.extracted_text ?? "",
    templateText: row.template_text ?? "",
    templateJson: parseJsonObject(row.template_json),
    uploadSource: row.upload_source === "manual" ? "manual" : "docx",
    isDefault: row.is_default ?? false,
    createdAt: toISOStringOrEmpty(row.created_at),
    updatedAt: toISOStringOrEmpty(row.updated_at),
  };
}

export function mapTailoredResume(row: TailoredResumeRow): TailoredResume {
  const allowedStatus: TailoredResume["status"][] = [
    "draft",
    "reviewed",
    "approved",
    "rejected",
    "stale",
  ];

  const mappedStatus = allowedStatus.includes((row.status ?? "") as TailoredResume["status"])
    ? (row.status as TailoredResume["status"])
    : "draft";

  return {
    id: row.id,
    jobId: row.job_id,
    resumeTemplateId: row.resume_template_id,
    status: mappedStatus,
    tailoredText: row.tailored_text ?? "",
    tailoringNotes: row.tailoring_notes ?? "",
    keywordCoverage: parseJsonObject(row.keyword_coverage),
    matchScore: row.match_score,
    outputFilename: row.output_filename ?? "",
    outputDocxStoragePath: row.output_docx_storage_path ?? "",
    sourceDocxStoragePath: row.source_docx_storage_path ?? "",
    createdAt: toISOStringOrEmpty(row.created_at),
    updatedAt: toISOStringOrEmpty(row.updated_at),
  };
}

export function mapJobSource(row: JobSourceRow): JobSource {
  return {
    id: String(row.id),
    sourceName: row.name,
    sourceType: mapSourceType(row.source_type),
    url: row.url,
    companyName: row.company_name ?? "",
    companySlug: row.company_slug ?? "",
    enabled: row.enabled ?? true,
    lastRunAt: toISOStringOrEmpty(row.last_run_at),
    lastSuccessAt: toISOStringOrEmpty(row.last_success_at),
    lastError: row.last_error ?? "",
    runCount: row.run_count ?? 0,
  };
}

type JobRowWithRelations = JobRow & {
  job_sources?: { name: string | null; source_type: string | null } | null;
  application_packets?: ApplicationPacketRow[] | ApplicationPacketRow | null;
};

function pickPacket(
  packets: ApplicationPacketRow[] | ApplicationPacketRow | null | undefined,
): ApplicationPacketRow | null {
  if (!packets) {
    return null;
  }
  return Array.isArray(packets) ? packets[0] ?? null : packets;
}

export function mapJob(row: JobRowWithRelations): Job {
  const packet = pickPacket(row.application_packets);

  return {
    id: String(row.id),
    company: row.company ?? "",
    role: row.title,
    location: row.location ?? "",
    source: row.job_sources?.name ?? "",
    sourceType: row.job_sources?.source_type ?? "",
    sourceId: row.source_id != null ? String(row.source_id) : "",
    status: mapJobStatus(row.status),
    matchScore: row.match_score ?? 0,
    postedDate: toDateString(row.created_at),
    description: row.description ?? "",
    applyUrl: row.apply_url ?? null,
    matchReason: row.match_reason ?? "",
    riskNotes: packet?.risk_notes ?? "",
    tailoredResumeDraft: packet?.tailored_resume ?? "",
    coverLetterDraft: packet?.cover_letter ?? "",
    shortAnswerDrafts: parseShortAnswers(packet?.short_answers),
    autoApplyEnabled: row.auto_apply_enabled ?? false,
    autoApplyStatus: mapAutoApplyStatus(row.auto_apply_status),
    autoApplyApprovedAt: toISOStringOrEmpty(row.auto_apply_approved_at),
    autoApplyError: row.auto_apply_error ?? "",
  };
}

type ApplicationRowWithRelations = ApplicationRow & {
  jobs?: { title: string | null; company: string | null } | null;
};

export function mapApplication(row: ApplicationRowWithRelations): Application {
  return {
    id: String(row.id),
    company: row.jobs?.company ?? "",
    role: row.jobs?.title ?? "",
    status: mapApplicationStatus(row.status),
    appliedDate: toDateString(row.applied_at),
    followUpDate: toDateString(row.follow_up_date),
    notes: row.notes ?? "",
  };
}

export function mapAutoApplyRun(row: AutoApplyRunRow): AutoApplyRun {
  return {
    id: String(row.id),
    jobId: String(row.job_id ?? ""),
    status: mapAutoApplyStatus(row.status),
    startedAt: toISOStringOrEmpty(row.started_at),
    finishedAt: toISOStringOrEmpty(row.finished_at),
    errorMessage: row.error_message ?? "",
    createdAt: toISOStringOrEmpty(row.created_at),
  };
}

export function toCommaSeparated(values: string[]): string {
  return values.join(", ");
}

export function toProfileSummary(profile: UserProfile): string {
  return [
    profile.name,
    profile.email,
    toListString(profile.skills),
    profile.summary,
  ]
    .filter(Boolean)
    .join(" | ");
}
