"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function parseJobId(jobId: string): number | null {
  const numericId = Number.parseInt(jobId, 10);
  return Number.isNaN(numericId) ? null : numericId;
}

function revalidateJobPaths(jobId: string): void {
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

function mapRlsErrorMessage(message: string, code?: string): string {
  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    return "Update blocked by Supabase RLS. Apply the latest migration that adds jobs, auto_apply_runs, and tailored_resumes policies, then retry.";
  }

  return message;
}

async function upsertTailoredDraft(jobId: number, resumeTemplateId: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to tailor resumes.",
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, source_id, title, company, match_score")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, message: jobError?.message ?? "Job not found." };
  }

  const { data: template, error: templateError } = await supabase
    .from("resume_templates")
    .select("id, extracted_text, template_text")
    .eq("id", resumeTemplateId)
    .maybeSingle();

  if (templateError || !template) {
    return { ok: false, message: templateError?.message ?? "Resume template not found." };
  }

  const sourceText = (template.extracted_text || template.template_text || "").trim();
  const companyName = job.company ?? "Unknown Company";
  const tailoredText = `Tailored for ${job.title} at ${companyName}.\n\n${sourceText}`.trim();

  const keywordCoverage = {
    status: "stub",
    message: "Keyword coverage will be generated later.",
  };

  const draftPayload = {
    job_id: job.id,
    resume_template_id: template.id,
    status: "draft",
    tailored_text: tailoredText,
    tailoring_notes:
      "Draft generated automatically from the selected resume template. Review before using.",
    keyword_coverage: keywordCoverage,
    match_score: job.match_score,
  };

  const { data: existingDrafts, error: draftsError } = await supabase
    .from("tailored_resumes")
    .select("id")
    .eq("job_id", job.id)
    .eq("resume_template_id", template.id)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  if (draftsError) {
    return { ok: false, message: draftsError.message };
  }

  const activeDraft = existingDrafts?.[0] ?? null;
  const duplicateDraftIds = existingDrafts?.slice(1).map((row) => row.id) ?? [];

  if (duplicateDraftIds.length > 0) {
    const { error: staleError } = await supabase
      .from("tailored_resumes")
      .update({ status: "stale" })
      .in("id", duplicateDraftIds);

    if (staleError) {
      return { ok: false, message: staleError.message };
    }
  }

  const { error } = activeDraft
    ? await supabase.from("tailored_resumes").update(draftPayload).eq("id", activeDraft.id)
    : await supabase.from("tailored_resumes").insert(draftPayload);

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
  return { ok: true };
}

export async function approveAutoApply(jobId: string): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to approve auto-apply.",
    };
  }

  const numericId = parseJobId(jobId);
  if (numericId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const { error: jobError } = await supabase
    .from("jobs")
    .update({
      auto_apply_enabled: true,
      auto_apply_status: "queued",
      auto_apply_approved_at: new Date().toISOString(),
      auto_apply_error: null,
    })
    .eq("id", numericId);

  if (jobError) {
    return { ok: false, message: mapRlsErrorMessage(jobError.message, jobError.code) };
  }

  const { error: runError } = await supabase.from("auto_apply_runs").insert({
    job_id: numericId,
    status: "queued",
  });

  if (runError) {
    return { ok: false, message: mapRlsErrorMessage(runError.message, runError.code) };
  }

  revalidateJobPaths(jobId);
  return { ok: true };
}

export async function cancelAutoApply(jobId: string): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to cancel auto-apply.",
    };
  }

  const numericId = parseJobId(jobId);
  if (numericId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      auto_apply_enabled: false,
      auto_apply_status: "canceled",
    })
    .eq("id", numericId);

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidateJobPaths(jobId);
  return { ok: true };
}

export async function generateTailoredResume(
  jobId: string,
  resumeTemplateId: number,
): Promise<ActionResult> {
  const numericJobId = parseJobId(jobId);
  if (numericJobId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const numericTemplateId = Number.isNaN(resumeTemplateId)
    ? null
    : Number.parseInt(String(resumeTemplateId), 10);
  if (numericTemplateId == null || Number.isNaN(numericTemplateId)) {
    return { ok: false, message: "Invalid resume template id." };
  }

  return upsertTailoredDraft(numericJobId, numericTemplateId);
}

export async function automaticallyTailorResume(
  jobId: string,
  resumeTemplateId: number,
): Promise<ActionResult> {
  return generateTailoredResume(jobId, resumeTemplateId);
}

export async function regenerateTailoredResume(
  jobId: string,
  resumeTemplateId: number,
): Promise<ActionResult> {
  return generateTailoredResume(jobId, resumeTemplateId);
}

export async function markTailoredResumeReviewed(id: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to update tailored resumes.",
    };
  }

  const { data, error: readError } = await supabase
    .from("tailored_resumes")
    .select("id, job_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !data) {
    return { ok: false, message: readError?.message ?? "Tailored resume not found." };
  }

  const { error } = await supabase
    .from("tailored_resumes")
    .update({ status: "reviewed" })
    .eq("id", id);

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidatePath(`/jobs/${data.job_id}`);
  return { ok: true };
}

export async function approveTailoredResume(id: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to update tailored resumes.",
    };
  }

  const { data, error: readError } = await supabase
    .from("tailored_resumes")
    .select("id, job_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !data) {
    return { ok: false, message: readError?.message ?? "Tailored resume not found." };
  }

  const { error } = await supabase
    .from("tailored_resumes")
    .update({ status: "approved" })
    .eq("id", id);

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidatePath(`/jobs/${data.job_id}`);
  return { ok: true };
}

export async function rejectTailoredResume(id: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to update tailored resumes.",
    };
  }

  const { data, error: readError } = await supabase
    .from("tailored_resumes")
    .select("id, job_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !data) {
    return { ok: false, message: readError?.message ?? "Tailored resume not found." };
  }

  const { error } = await supabase
    .from("tailored_resumes")
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidatePath(`/jobs/${data.job_id}`);
  return { ok: true };
}

export async function updateTailoredResumeText(
  id: number,
  tailoredText: string,
): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to update tailored resumes.",
    };
  }

  const { data, error: readError } = await supabase
    .from("tailored_resumes")
    .select("id, job_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !data) {
    return { ok: false, message: readError?.message ?? "Tailored resume not found." };
  }

  const { error } = await supabase
    .from("tailored_resumes")
    .update({ tailored_text: tailoredText })
    .eq("id", id);

  if (error) {
    return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
  }

  revalidatePath(`/jobs/${data.job_id}`);
  return { ok: true };
}
