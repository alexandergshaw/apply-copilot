import sanitizeFilename from "sanitize-filename";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/types";

const SOURCE_TEMPLATE_BUCKET = "resume-templates";
const TAILORED_RESUMES_BUCKET = "tailored-resumes";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function safeSegment(value: string): string {
  const sanitized = sanitizeFilename(value).replace(/\s+/g, "-").toLowerCase();
  return sanitized || "unknown";
}

export async function downloadResumeTemplateDocx(
  supabase: SupabaseClient<Database>,
  storagePath: string,
): Promise<Buffer> {
  const path = storagePath.trim();
  if (!path) {
    throw new Error("Resume template DOCX path is required.");
  }

  const { data, error } = await supabase.storage.from(SOURCE_TEMPLATE_BUCKET).download(path);
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to download source resume template DOCX.");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

type UploadTailoredResumeDocxParams = {
  profileId: string;
  jobId: number;
  resumeTemplateId: number;
  outputFilename: string;
  outputDocxBuffer: Buffer;
  upsert?: boolean;
};

export async function uploadTailoredResumeDocx(
  supabase: SupabaseClient<Database>,
  params: UploadTailoredResumeDocxParams,
): Promise<{ path: string }> {
  const profileSegment = safeSegment(params.profileId);
  const timestamp = Date.now();
  const filePath = `${profileSegment}/${params.jobId}/tailored-resume-${params.resumeTemplateId}-${timestamp}.docx`;

  const { error } = await supabase.storage.from(TAILORED_RESUMES_BUCKET).upload(filePath, params.outputDocxBuffer, {
    contentType: DOCX_MIME,
    upsert: params.upsert ?? false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { path: filePath };
}