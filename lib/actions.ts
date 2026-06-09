"use server";

import { revalidatePath } from "next/cache";

import type { Profile, SourceType } from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function toList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export type ActionResult = { ok: boolean; message?: string };

const NOT_CONFIGURED: ActionResult = {
  ok: false,
  message: "Supabase is not configured. Add environment variables to persist changes.",
};

function parseJobId(jobId: string): number | null {
  const numericId = Number.parseInt(jobId, 10);
  return Number.isNaN(numericId) ? null : numericId;
}

function mapRlsErrorMessage(message: string, code?: string): string {
  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    return "Action blocked by Supabase RLS. Apply the latest migration that adds application_packets policies, then retry.";
  }

  return message;
}

// --- Profile ---------------------------------------------------------------

export async function updateProfile(
  profileId: string | null,
  profile: Profile,
): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const salary = Number.parseInt(profile.minimumSalary, 10);
  const row = {
    name: profile.name,
    target_titles: toList(profile.targetTitles),
    target_locations: toList(profile.targetLocations),
    min_salary: Number.isNaN(salary) ? null : salary,
    remote_preference: profile.remotePreference,
    skills: toList(profile.skills),
    resume_text: profile.resumeText,
  };
  const { error } = profileId
    ? await supabase.from("user_profiles").update(row).eq("id", profileId)
    : await supabase.from("user_profiles").insert(row);

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidatePath("/profile");
  return { ok: true };
}

// --- Job sources -----------------------------------------------------------

export type JobSourceInput = {
  sourceName: string;
  sourceType: SourceType;
  url: string;
  companyName: string;
  companySlug: string;
  fetchIntervalMinutes: string;
  enabled: boolean;
};

function parseFetchIntervalMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function createJobSource(input: JobSourceInput): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const { error } = await supabase.from("job_sources").insert({
    name: input.sourceName,
    source_type: input.sourceType,
    url: input.url,
    company_name: input.companyName.trim() || null,
    company_slug: input.companySlug.trim() || null,
    fetch_interval_minutes: parseFetchIntervalMinutes(input.fetchIntervalMinutes),
    enabled: input.enabled,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/sources");
  return { ok: true };
}

export async function updateJobSource(
  id: string,
  input: JobSourceInput,
): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return { ok: false, message: "Invalid source id." };
  }

  const { error } = await supabase
    .from("job_sources")
    .update({
      name: input.sourceName,
      source_type: input.sourceType,
      url: input.url,
      company_name: input.companyName.trim() || null,
      company_slug: input.companySlug.trim() || null,
      fetch_interval_minutes: parseFetchIntervalMinutes(input.fetchIntervalMinutes),
      enabled: input.enabled,
    })
    .eq("id", numericId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/sources");
  return { ok: true };
}

export async function deleteJobSource(id: string): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return { ok: false, message: "Invalid source id." };
  }

  const { error } = await supabase.from("job_sources").delete().eq("id", numericId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/sources");
  return { ok: true };
}

export async function runJobFetchForSource(id: string): Promise<ActionResult> {
  const numericId = Number.parseInt(id, 10);
  if (Number.isNaN(numericId)) {
    return { ok: false, message: "Invalid source id." };
  }

  try {
    const { fetchJobsForSourceId } = await import("@/workers/job-fetcher/fetch-all");
    const result = await fetchJobsForSourceId(numericId);

    revalidatePath("/jobs");
    revalidatePath("/sources");
    revalidatePath("/dashboard");

    if (result.status === "failed") {
      return {
        ok: false,
        message: result.error ?? "Job fetch failed for this source.",
      };
    }

    const { jobsInserted, jobsUpdated, jobsSkipped } = result.summary;
    return {
      ok: true,
      message: `Fetched ${jobsInserted} new and ${jobsUpdated} updated job(s) (${jobsSkipped} skipped).`,
    };
  } catch (error) {
    // Never leak raw stack traces to the user.
    const message =
      error instanceof Error ? error.message : "Unable to run job fetch for this source.";
    return { ok: false, message };
  }
}

// --- Jobs ------------------------------------------------------------------

function revalidateJob(jobId: string) {
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
}

export async function updateJobStatus(jobId: string, status: string): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const numericId = parseJobId(jobId);
  if (numericId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const { error } = await supabase.from("jobs").update({ status }).eq("id", numericId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateJob(jobId);
  return { ok: true };
}

export async function saveJobForLater(jobId: string): Promise<ActionResult> {
  return updateJobStatus(jobId, "review");
}

export async function rejectJob(jobId: string): Promise<ActionResult> {
  return updateJobStatus(jobId, "rejected");
}

export async function markJobApplied(jobId: string): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const numericId = parseJobId(jobId);
  if (numericId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const { error: jobError } = await supabase
    .from("jobs")
    .update({ status: "applied" })
    .eq("id", numericId);

  if (jobError) {
    return { ok: false, message: mapRlsErrorMessage(jobError.message, jobError.code) };
  }

  const { error: applicationError } = await supabase.from("applications").insert({
    job_id: numericId,
    status: "submitted",
    applied_at: new Date().toISOString(),
  });

  if (applicationError) {
    return {
      ok: false,
      message: mapRlsErrorMessage(applicationError.message, applicationError.code),
    };
  }

  revalidateJob(jobId);
  revalidatePath("/applications");
  return { ok: true };
}

export async function createApplicationPacketPlaceholder(jobId: string): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const numericId = parseJobId(jobId);
  if (numericId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  // Placeholder packet only. AI-generated content is intentionally not
  // implemented yet.
  const { error } = await supabase.from("application_packets").insert({
    job_id: numericId,
    tailored_resume: "",
    cover_letter: "",
    short_answers: [],
    risk_notes: "",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateJob(jobId);
  return { ok: true };
}

export async function tailorResumeToManualJob(
  jobId: string,
  resumeTemplateId: number,
): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const numericId = parseJobId(jobId);
  if (numericId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("title, company")
    .eq("id", numericId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, message: jobError?.message ?? "Job not found." };
  }

  const { data: template, error: templateError } = await supabase
    .from("resume_templates")
    .select("extracted_text, template_text")
    .eq("id", resumeTemplateId)
    .maybeSingle();

  if (templateError || !template) {
    return { ok: false, message: templateError?.message ?? "Resume template not found." };
  }

  const sourceText = (template.extracted_text || template.template_text || "").trim();
  const companyName = job.company ?? "Unknown Company";
  const tailoredResume = `Tailored for ${job.title} at ${companyName}.\n\n${sourceText}`.trim();

  const { data: packet } = await supabase
    .from("application_packets")
    .select("id")
    .eq("job_id", numericId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    tailored_resume: tailoredResume,
    tailoring_notes:
      "Generated from uploaded .docx resume template. Replace with LLM generation later.",
  };

  const { error } = packet
    ? await supabase.from("application_packets").update(payload).eq("id", packet.id)
    : await supabase.from("application_packets").insert({
        job_id: numericId,
        ...payload,
      });

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidateJob(jobId);
  return { ok: true };
}
