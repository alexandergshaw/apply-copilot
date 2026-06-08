"use server";

import { revalidatePath } from "next/cache";

import type { Profile, SourceType } from "@/lib/mock-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { profileToRow } from "@/lib/supabase/types";

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

  const row = profileToRow(profile);
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
  enabled: boolean;
};

export async function createJobSource(input: JobSourceInput): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NOT_CONFIGURED;
  }

  const { error } = await supabase.from("job_sources").insert({
    name: input.sourceName,
    source_type: input.sourceType,
    url: input.url,
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
