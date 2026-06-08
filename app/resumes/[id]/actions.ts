"use server";

import mammoth from "mammoth";
import { revalidatePath } from "next/cache";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const RESUME_TEMPLATE_BUCKET = "resume-templates";
const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ActionResult = { ok: boolean; message?: string };

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isChecked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function sanitizeFilename(filename: string): string {
  const normalized = filename.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!normalized.toLowerCase().endsWith(".docx")) {
    return `${normalized || "resume-template"}.docx`;
  }
  return normalized || "resume-template.docx";
}

function parseTemplateJson(text: string): { value?: Record<string, unknown>; error?: string } {
  const input = text || "{}";
  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Template JSON must be a JSON object." };
    }
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: "Template JSON contains invalid JSON." };
  }
}

function validateDocx(file: File | null): { ok: boolean; message?: string } {
  if (!file) {
    return { ok: false, message: "Please choose a .docx file." };
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { ok: false, message: "Only .docx files are supported." };
  }

  if (file.size > MAX_DOCX_BYTES) {
    return { ok: false, message: "File is too large. Maximum size is 10 MB." };
  }

  if (file.type && file.type !== DOCX_MIME) {
    return { ok: false, message: "Invalid file type. Upload a Word .docx file." };
  }

  return { ok: true };
}

async function clearOtherDefaults(profileId: string, keepId: number): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return "Supabase is not configured.";
  }

  const { error } = await supabase
    .from("resume_templates")
    .update({ is_default: false })
    .eq("profile_id", profileId)
    .neq("id", keepId);

  return error ? error.message : null;
}

export async function updateResumeTemplate(id: number, formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to update templates.",
    };
  }

  const name = getText(formData, "name");
  if (!name) {
    return { ok: false, message: "Name is required." };
  }

  const templateJson = parseTemplateJson(getText(formData, "template_json"));
  if (templateJson.error) {
    return { ok: false, message: templateJson.error };
  }

  const { data: current, error: currentError } = await supabase
    .from("resume_templates")
    .select("profile_id")
    .eq("id", id)
    .maybeSingle();

  if (currentError || !current) {
    return { ok: false, message: currentError?.message ?? "Template not found." };
  }

  const isDefault = isChecked(formData, "is_default");

  const { error } = await supabase
    .from("resume_templates")
    .update({
      name,
      target_role: getText(formData, "target_role") || null,
      extracted_text: getText(formData, "extracted_text") || null,
      template_text: getText(formData, "template_text") || null,
      template_json: templateJson.value ?? {},
      is_default: isDefault,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (isDefault) {
    const defaultError = await clearOtherDefaults(current.profile_id, id);
    if (defaultError) {
      return { ok: false, message: defaultError };
    }
  }

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${id}`);
  revalidatePath("/jobs");
  return { ok: true };
}

export async function replaceResumeTemplateDocx(
  templateId: number,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to replace .docx files.",
    };
  }

  const fileValue = formData.get("docx_file");
  const file = fileValue instanceof File ? fileValue : null;
  const validation = validateDocx(file);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const { data: current, error: currentError } = await supabase
    .from("resume_templates")
    .select("id, profile_id, docx_storage_path, extracted_text, template_text")
    .eq("id", templateId)
    .maybeSingle();

  if (currentError || !current) {
    return { ok: false, message: currentError?.message ?? "Template not found." };
  }

  const filename = file?.name ?? "resume-template.docx";
  const safeFilename = sanitizeFilename(filename);
  const storagePath = `${current.profile_id}/${templateId}/${safeFilename}`;
  const bytes = new Uint8Array(await file!.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(RESUME_TEMPLATE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: DOCX_MIME,
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  if (current.docx_storage_path && current.docx_storage_path !== storagePath) {
    await supabase.storage.from(RESUME_TEMPLATE_BUCKET).remove([current.docx_storage_path]);
  }

  let extractedText = "";
  let extractionError: string | null = null;
  try {
    const extracted = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    extractedText = extracted.value.trim();
  } catch {
    extractionError =
      "New .docx file was uploaded, but text extraction failed. Edit extracted text manually.";
  }

  const { error: updateError } = await supabase
    .from("resume_templates")
    .update({
      original_filename: filename,
      docx_storage_path: storagePath,
      extracted_text: extractionError ? current.extracted_text : extractedText,
      template_text: extractionError ? current.template_text : extractedText,
      upload_source: "docx",
    })
    .eq("id", templateId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${templateId}`);
  revalidatePath("/jobs");

  if (extractionError) {
    return { ok: false, message: extractionError };
  }

  return { ok: true };
}
