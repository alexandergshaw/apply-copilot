"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions";
import {
  getDefaultResumeTemplateForProfile,
  getResumeTemplates,
  getUserProfile,
} from "@/lib/queries";
import {
  downloadResumeTemplateDocx,
  tailorResume,
  uploadTailoredResumeDocx,
} from "@/lib/resume-tailoring";
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

type TailorDraftResult = {
  ok: true;
  message: string;
  jobId: number;
  resumeTemplateId: number;
  tailoredResumeId: number;
  outputFilename: string;
};

function isTailorDraftResult(result: ActionResult | TailorDraftResult): result is TailorDraftResult {
  return result.ok === true && "tailoredResumeId" in result;
}

async function upsertTailoredDraft(jobId: number, resumeTemplateId: number): Promise<ActionResult | TailorDraftResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to tailor resumes.",
    };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, title, company, location, salary, description, match_score")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, message: jobError?.message ?? "Job not found." };
  }

  const { data: template, error: templateError } = await supabase
    .from("resume_templates")
    .select(
      "id, profile_id, name, target_role, original_filename, docx_storage_path, extracted_text, template_text, template_json",
    )
    .eq("id", resumeTemplateId)
    .maybeSingle();

  if (templateError || !template) {
    return { ok: false, message: templateError?.message ?? "Resume template not found." };
  }

  if (!template.docx_storage_path) {
    return {
      ok: false,
      message: "Selected resume template does not have a source DOCX file.",
    };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", template.profile_id)
    .maybeSingle();

  let sourceDocxBuffer: Buffer;
  try {
    sourceDocxBuffer = await downloadResumeTemplateDocx(supabase, template.docx_storage_path);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to download source template DOCX.";
    return { ok: false, message };
  }

  const tailoredResult = await tailorResume({
    job,
    resumeTemplate: template,
    sourceDocxBuffer,
    profile: profile ?? undefined,
    mode: "stub",
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Failed to tailor resume.";
    return { error: message };
  });

  if ("error" in tailoredResult) {
    return { ok: false, message: tailoredResult.error };
  }

  let uploadPath: string;
  try {
    const uploaded = await uploadTailoredResumeDocx(supabase, {
      profileId: template.profile_id,
      jobId: job.id,
      resumeTemplateId: template.id,
      outputFilename: tailoredResult.outputFilename,
      outputDocxBuffer: tailoredResult.outputDocxBuffer,
    });
    uploadPath = uploaded.path;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload tailored DOCX.";
    return { ok: false, message };
  }

  const draftPayload = {
    job_id: job.id,
    resume_template_id: template.id,
    status: tailoredResult.status,
    tailored_text: tailoredResult.tailoredText,
    tailoring_notes: tailoredResult.tailoringNotes,
    keyword_coverage: tailoredResult.keywordCoverage,
    match_score: tailoredResult.matchScore,
    source_docx_storage_path: tailoredResult.sourceDocxStoragePath,
    output_docx_storage_path: uploadPath,
    output_filename: tailoredResult.outputFilename,
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

  let tailoredResumeId: number;
  if (activeDraft) {
    const { data: updatedRows, error } = await supabase
      .from("tailored_resumes")
      .update(draftPayload)
      .eq("id", activeDraft.id)
      .select("id")
      .limit(1);

    if (error) {
      return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
    }

    tailoredResumeId = updatedRows?.[0]?.id ?? activeDraft.id;
  } else {
    const { data: insertedRows, error } = await supabase
      .from("tailored_resumes")
      .insert(draftPayload)
      .select("id")
      .limit(1);

    if (error) {
      return { ok: false, message: mapRlsErrorMessage(error.message, error.code) };
    }

    const insertedId = insertedRows?.[0]?.id;
    if (!insertedId) {
      return { ok: false, message: "Tailored resume draft saved, but no record id was returned." };
    }
    tailoredResumeId = insertedId;
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${job.id}`);
  return {
    ok: true,
    jobId: job.id,
    resumeTemplateId: template.id,
    tailoredResumeId,
    outputFilename: tailoredResult.outputFilename,
    message: "Tailored DOCX draft generated. Review before using.",
  };
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

  const result = await upsertTailoredDraft(numericJobId, numericTemplateId);
  if (!result.ok) {
    return result;
  }
  return { ok: true, message: result.message };
}

export async function automaticallyTailorResume(
  jobId: string,
  resumeTemplateId: number,
): Promise<ActionResult> {
  return generateTailoredResume(jobId, resumeTemplateId);
}

export type TailorResumeForDownloadResult = ActionResult & {
  tailoredResumeId?: number;
  jobId?: number;
  outputFilename?: string;
};

export async function tailorResumeForDownload(jobId: string): Promise<TailorResumeForDownloadResult> {
  const numericJobId = parseJobId(jobId);
  if (numericJobId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const profile = await getUserProfile();
  if (!profile) {
    return { ok: false, message: "No user profile found. Create your profile first." };
  }

  const defaultTemplate = await getDefaultResumeTemplateForProfile(profile.id);
  let selectedTemplateId = defaultTemplate?.id ?? null;

  if (selectedTemplateId == null) {
    const templates = await getResumeTemplates();
    selectedTemplateId = templates[0]?.id ?? null;
  }

  if (selectedTemplateId == null) {
    return { ok: false, message: "No resume template found. Upload one first." };
  }

  const result = await upsertTailoredDraft(numericJobId, selectedTemplateId);
  if (!isTailorDraftResult(result)) {
    return result;
  }

  return {
    ok: true,
    message: result.message,
    tailoredResumeId: result.tailoredResumeId,
    jobId: result.jobId,
    outputFilename: result.outputFilename,
  };
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
