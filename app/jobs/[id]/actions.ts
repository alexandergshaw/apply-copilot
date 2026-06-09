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
import type { ResumeTailoringMode } from "@/lib/resume-tailoring/types";
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

function resolveTailoringMode(forcedMode?: ResumeTailoringMode): {
  mode: ResumeTailoringMode;
  configError?: string;
} {
  const configuredMode = process.env.RESUME_TAILORING_MODE?.trim().toLowerCase();
  const useLlm = forcedMode === "llm" || (!forcedMode && configuredMode === "llm");

  if (useLlm) {
    if (!process.env.GEMINI_API_KEY?.trim()) {
      return {
        mode: "llm",
        configError:
          "AI resume tailoring requires Gemini, but it is not configured. Set GEMINI_API_KEY (and optional GEMINI_MODEL) to generate a tailored resume.",
      };
    }

    return { mode: "llm" };
  }

  return { mode: forcedMode ?? "stub" };
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

async function upsertTailoredDraft(
  jobId: number,
  resumeTemplateId: number,
  forcedMode?: ResumeTailoringMode,
): Promise<ActionResult | TailorDraftResult> {
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

  const modeConfig = resolveTailoringMode(forcedMode);
  if (modeConfig.configError) {
    return { ok: false, message: modeConfig.configError };
  }

  const tailoredResult = await tailorResume({
    job,
    resumeTemplate: template,
    sourceDocxBuffer,
    profile: profile ?? undefined,
    mode: modeConfig.mode,
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

function buildCoverLetter(input: {
  company: string;
  title: string;
  location: string;
  profileName: string;
  profileSummary: string;
  skills: string[];
  tailoredResumeText: string;
}): string {
  const topSkills = input.skills.slice(0, 4).join(", ");
  const resumeSnippet = input.tailoredResumeText.split("\n").filter(Boolean).slice(0, 3).join(" ");

  return [
    `Dear ${input.company} Hiring Team,`,
    "",
    `I am excited to apply for the ${input.title} role in ${input.location}.`,
    `${input.profileName} brings a strong track record aligned to this position${
      input.profileSummary ? `, including ${input.profileSummary}.` : "."
    }`,
    topSkills ? `Relevant strengths include: ${topSkills}.` : "",
    resumeSnippet ? `Recent experience highlights: ${resumeSnippet}` : "",
    "",
    "Thank you for your consideration.",
  ]
    .filter(Boolean)
    .join("\n");
}

type ShortAnswer = {
  question: string;
  answer: string;
};

function buildShortAnswers(input: {
  profile: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    portfolioUrl: string;
    githubUrl: string;
    summary: string;
    skills: string[];
  };
  job: {
    title: string;
    company: string | null;
  };
}): ShortAnswer[] {
  const { profile, job } = input;

  return [
    {
      question: "What is your full name?",
      answer: profile.name || "Not provided",
    },
    {
      question: "What email should we use to contact you?",
      answer: profile.email || "Not provided",
    },
    {
      question: "What phone number should we use to contact you?",
      answer: profile.phone || "Not provided",
    },
    {
      question: "Where are you currently located?",
      answer: profile.location || "Not provided",
    },
    {
      question: "Share your LinkedIn profile.",
      answer: profile.linkedinUrl || "Not provided",
    },
    {
      question: "Share your portfolio website.",
      answer: profile.portfolioUrl || "Not provided",
    },
    {
      question: "Share your GitHub profile.",
      answer: profile.githubUrl || "Not provided",
    },
    {
      question: "Why are you interested in this role?",
      answer: `I am excited about the ${job.title} role at ${job.company ?? "your company"} because it aligns with my product background and the impact described in the posting.`,
    },
    {
      question: "What are your strongest relevant skills?",
      answer: profile.skills.length > 0 ? profile.skills.slice(0, 6).join(", ") : "Not provided",
    },
    {
      question: "Give a brief professional summary.",
      answer: profile.summary || "Not provided",
    },
  ];
}

async function updateAutoApplyRunStatus(
  runId: number | null,
  status: string,
  errorMessage?: string,
): Promise<void> {
  if (!runId) {
    return;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase
    .from("auto_apply_runs")
    .update({
      status,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function autoApplyNow(jobId: string): Promise<ActionResult> {
  const numericJobId = parseJobId(jobId);
  if (numericJobId == null) {
    return { ok: false, message: "Invalid job id." };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to run auto-apply.",
    };
  }

  const runStartedAt = new Date().toISOString();
  let runId: number | null = null;

  const { data: runInsertData } = await supabase
    .from("auto_apply_runs")
    .insert({
      job_id: numericJobId,
      status: "running",
      started_at: runStartedAt,
    })
    .select("id")
    .limit(1);

  runId = runInsertData?.[0]?.id ?? null;

  await supabase
    .from("jobs")
    .update({
      auto_apply_enabled: true,
      auto_apply_status: "running",
      auto_apply_error: null,
      auto_apply_approved_at: runStartedAt,
    })
    .eq("id", numericJobId);

  const profile = await getUserProfile();
  if (!profile) {
    const message = "No profile found. Complete your profile before auto-apply.";
    await supabase
      .from("jobs")
      .update({ auto_apply_status: "blocked", auto_apply_error: message })
      .eq("id", numericJobId);
    await updateAutoApplyRunStatus(runId, "blocked", message);
    revalidateJobPaths(jobId);
    return { ok: false, message };
  }

  const defaultTemplate = await getDefaultResumeTemplateForProfile(profile.id);
  const resumeTemplateId = defaultTemplate?.id;

  if (!resumeTemplateId) {
    const message = "No default resume template found. Set a default template before auto-apply.";
    await supabase
      .from("jobs")
      .update({ auto_apply_status: "blocked", auto_apply_error: message })
      .eq("id", numericJobId);
    await updateAutoApplyRunStatus(runId, "blocked", message);
    revalidateJobPaths(jobId);
    return { ok: false, message };
  }

  const { data: existingTailoredResume } = await supabase
    .from("tailored_resumes")
    .select("id, status, tailored_text, tailoring_notes")
    .eq("job_id", numericJobId)
    .eq("resume_template_id", resumeTemplateId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let activeTailoredResume = existingTailoredResume;
  if (!activeTailoredResume) {
    const tailoredResult = await upsertTailoredDraft(numericJobId, resumeTemplateId, "llm");
    if (!isTailorDraftResult(tailoredResult)) {
      const message = tailoredResult.message ?? "Unable to tailor resume for auto-apply.";
      await supabase
        .from("jobs")
        .update({ auto_apply_status: "failed", auto_apply_error: message })
        .eq("id", numericJobId);
      await updateAutoApplyRunStatus(runId, "failed", message);
      revalidateJobPaths(jobId);
      return { ok: false, message };
    }

    const { data: generatedTailoredResume, error: generatedResumeError } = await supabase
      .from("tailored_resumes")
      .select("id, status, tailored_text, tailoring_notes")
      .eq("id", tailoredResult.tailoredResumeId)
      .maybeSingle();

    if (generatedResumeError || !generatedTailoredResume) {
      const message = generatedResumeError?.message ?? "Tailored resume was not found after generation.";
      await supabase
        .from("jobs")
        .update({ auto_apply_status: "failed", auto_apply_error: message })
        .eq("id", numericJobId);
      await updateAutoApplyRunStatus(runId, "failed", message);
      revalidateJobPaths(jobId);
      return { ok: false, message };
    }

    activeTailoredResume = generatedTailoredResume;
  }

  if (activeTailoredResume.status !== "approved") {
    const message =
      "Auto-apply paused for review. Approve the tailored resume in Resume Tailoring first (or regenerate it), then run Auto Apply again.";

    await supabase
      .from("jobs")
      .update({
        auto_apply_status: "needs_review",
        auto_apply_error: message,
      })
      .eq("id", numericJobId);
    await updateAutoApplyRunStatus(runId, "needs_review", message);
    revalidateJobPaths(jobId);

    return { ok: true, message };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("title, company, location")
    .eq("id", numericJobId)
    .maybeSingle();

  if (jobError || !job) {
    const message = jobError?.message ?? "Job not found during auto-apply.";
    await supabase
      .from("jobs")
      .update({ auto_apply_status: "failed", auto_apply_error: message })
      .eq("id", numericJobId);
    await updateAutoApplyRunStatus(runId, "failed", message);
    revalidateJobPaths(jobId);
    return { ok: false, message };
  }

  const coverLetter = buildCoverLetter({
    company: job.company ?? "the team",
    title: job.title,
    location: job.location ?? "your location",
    profileName: profile.name || "I",
    profileSummary: profile.summary || "",
    skills: profile.skills,
    tailoredResumeText: activeTailoredResume.tailored_text,
  });

  const shortAnswers = buildShortAnswers({
    profile: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      linkedinUrl: profile.linkedinUrl,
      portfolioUrl: profile.portfolioUrl,
      githubUrl: profile.githubUrl,
      summary: profile.summary,
      skills: profile.skills,
    },
    job,
  });

  const missingRequiredFields: string[] = [];
  if (!profile.name.trim()) {
    missingRequiredFields.push("name");
  }
  if (!profile.email.trim()) {
    missingRequiredFields.push("email");
  }
  if (!profile.phone.trim()) {
    missingRequiredFields.push("phone");
  }
  if (!profile.location.trim()) {
    missingRequiredFields.push("location");
  }
  if (!profile.linkedinUrl.trim()) {
    missingRequiredFields.push("LinkedIn URL");
  }
  if (!activeTailoredResume.tailored_text.trim()) {
    missingRequiredFields.push("tailored resume text");
  }
  if (!coverLetter.trim()) {
    missingRequiredFields.push("cover letter");
  }

  const packetPayload = {
    job_id: numericJobId,
    tailored_resume: activeTailoredResume.tailored_text,
    tailoring_notes: activeTailoredResume.tailoring_notes ?? "Generated via auto-apply.",
    cover_letter: coverLetter,
    short_answers: shortAnswers,
    risk_notes:
      missingRequiredFields.length > 0
        ? `Needs review before submission. Missing required fields: ${missingRequiredFields.join(", ")}.`
        : "Auto-generated packet. Review before external submission if needed.",
  };

  const { data: existingPacket } = await supabase
    .from("application_packets")
    .select("id")
    .eq("job_id", numericJobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: packetRows, error: packetError } = existingPacket
    ? await supabase
        .from("application_packets")
        .update(packetPayload)
        .eq("id", existingPacket.id)
        .select("id")
        .limit(1)
    : await supabase.from("application_packets").insert(packetPayload).select("id").limit(1);

  if (packetError) {
    const message = mapRlsErrorMessage(packetError.message, packetError.code);
    await supabase
      .from("jobs")
      .update({ auto_apply_status: "failed", auto_apply_error: message })
      .eq("id", numericJobId);
    await updateAutoApplyRunStatus(runId, "failed", message);
    revalidateJobPaths(jobId);
    return { ok: false, message };
  }

  const packetId = packetRows?.[0]?.id ?? existingPacket?.id ?? null;

  if (missingRequiredFields.length > 0) {
    const message =
      `Auto-apply paused for review. Missing required fields: ${missingRequiredFields.join(", ")}.`;

    await supabase
      .from("jobs")
      .update({
        auto_apply_status: "needs_review",
        auto_apply_error: message,
      })
      .eq("id", numericJobId);

    await updateAutoApplyRunStatus(runId, "needs_review", message);
    revalidateJobPaths(jobId);

    return {
      ok: true,
      message,
    };
  }

  const { data: existingApplication } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", numericJobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const applicationPayload = {
    packet_id: packetId,
    status: "submitted",
    applied_at: new Date().toISOString(),
    notes: "Submitted via Auto Apply.",
  };

  const { error: applicationError } = existingApplication
    ? await supabase
        .from("applications")
        .update(applicationPayload)
        .eq("id", existingApplication.id)
    : await supabase
        .from("applications")
        .insert({
          job_id: numericJobId,
          ...applicationPayload,
        });

  if (applicationError) {
    const message = mapRlsErrorMessage(applicationError.message, applicationError.code);
    await supabase
      .from("jobs")
      .update({ auto_apply_status: "failed", auto_apply_error: message })
      .eq("id", numericJobId);
    await updateAutoApplyRunStatus(runId, "failed", message);
    revalidateJobPaths(jobId);
    return { ok: false, message };
  }

  await supabase
    .from("jobs")
    .update({
      status: "applied",
      auto_apply_enabled: true,
      auto_apply_status: "submitted",
      auto_apply_error: null,
    })
    .eq("id", numericJobId);

  await updateAutoApplyRunStatus(runId, "submitted");
  revalidatePath("/applications");
  revalidateJobPaths(jobId);

  return {
    ok: true,
    message: "Auto-apply completed: tailored resume, cover letter, and application packet were saved.",
  };
}

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

  const result = await upsertTailoredDraft(numericJobId, selectedTemplateId, "llm");
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
