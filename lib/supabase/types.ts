// Database row types matching supabase/migrations and helpers to map Supabase
// rows onto the UI-facing types defined in lib/mock-data.

import type {
  Application,
  ApplicationStatus,
  AutoApplyRun,
  AutoApplyStatus,
  Job,
  JobSource,
  JobStatus,
  Profile,
  SourceType,
} from "@/lib/mock-data";

export type UserProfileRow = {
  id: string;
  name: string | null;
  target_titles: string[] | null;
  target_locations: string[] | null;
  min_salary: number | null;
  remote_preference: string | null;
  skills: string[] | null;
  resume_text: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type JobSourceRow = {
  id: number;
  name: string;
  source_type: string;
  url: string;
  enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
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
      };
      job_sources: {
        Row: JobSourceRow;
        Insert: Partial<JobSourceRow>;
        Update: Partial<JobSourceRow>;
      };
      jobs: {
        Row: JobRow;
        Insert: Partial<JobRow>;
        Update: Partial<JobRow>;
      };
      application_packets: {
        Row: ApplicationPacketRow;
        Insert: Partial<ApplicationPacketRow>;
        Update: Partial<ApplicationPacketRow>;
      };
      applications: {
        Row: ApplicationRow;
        Insert: Partial<ApplicationRow>;
        Update: Partial<ApplicationRow>;
      };
      auto_apply_runs: {
        Row: AutoApplyRunRow;
        Insert: Partial<AutoApplyRunRow>;
        Update: Partial<AutoApplyRunRow>;
      };
    };
  };
};

// --- Mapping helpers -------------------------------------------------------

function toListString(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

function fromListString(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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
  const allowed: SourceType[] = ["job board", "company", "recruiter", "referral"];
  return (allowed as string[]).includes(sourceType ?? "")
    ? (sourceType as SourceType)
    : "job board";
}

function mapRemotePreference(value: string | null | undefined): Profile["remotePreference"] {
  return value === "hybrid" || value === "onsite" ? value : "remote";
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
  // Normalize ISO timestamps to YYYY-MM-DD for display parity with mock data.
  return value.slice(0, 10);
}

function toISOStringOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

export function mapProfile(row: UserProfileRow): Profile {
  return {
    name: row.name ?? "",
    targetTitles: toListString(row.target_titles),
    targetLocations: toListString(row.target_locations),
    minimumSalary: row.min_salary != null ? String(row.min_salary) : "",
    remotePreference: mapRemotePreference(row.remote_preference),
    skills: toListString(row.skills),
    resumeText: row.resume_text ?? "",
  };
}

export function profileToRow(profile: Profile): Partial<UserProfileRow> {
  const salary = Number.parseInt(profile.minimumSalary, 10);

  return {
    name: profile.name,
    target_titles: fromListString(profile.targetTitles),
    target_locations: fromListString(profile.targetLocations),
    min_salary: Number.isNaN(salary) ? null : salary,
    remote_preference: profile.remotePreference,
    skills: fromListString(profile.skills),
    resume_text: profile.resumeText,
  };
}

export function mapJobSource(row: JobSourceRow): JobSource {
  return {
    id: String(row.id),
    sourceName: row.name,
    sourceType: mapSourceType(row.source_type),
    url: row.url,
    enabled: row.enabled ?? true,
  };
}

type JobRowWithRelations = JobRow & {
  job_sources?: { name: string | null } | null;
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
    status: mapJobStatus(row.status),
    matchScore: row.match_score ?? 0,
    postedDate: toDateString(row.created_at),
    description: row.description ?? "",
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
