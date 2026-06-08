"use server";

import mammoth from "mammoth";
import { revalidatePath } from "next/cache";

import { getSupabaseServerClient } from "@/lib/supabase/server";

const RESUME_TEMPLATE_BUCKET = "resume-templates";
const MAX_DOCX_BYTES = 10 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type ActionResult = { ok: boolean; message?: string; id?: number };

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

async function getOrCreateFirstProfileId(): Promise<{ profileId?: string; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      error: "Supabase is not configured. Add environment variables to save resume templates.",
    };
  }

  const { data: existing, error: readError } = await supabase
    .from("user_profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    return { error: readError.message };
  }

  if (existing?.id) {
    return { profileId: existing.id };
  }

  const { data: created, error: createError } = await supabase
    .from("user_profiles")
    .insert({ name: "", remote_preference: "remote", preferences: {} })
    .select("id")
    .single();

  if (createError || !created) {
    return {
      error: createError?.message ?? "Unable to create a profile for resume template storage.",
    };
  }

  return { profileId: created.id };
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

async function extractDocxText(fileBytes: Uint8Array): Promise<{ text?: string; error?: string }> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(fileBytes) });
    const text = result.value.trim();
    return { text };
  } catch {
    return { error: "Uploaded file was saved, but text extraction failed. Edit extracted text manually." };
  }
}

export async function createResumeTemplateFromDocx(formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to upload resume templates.",
    };
  }

  const profile = await getOrCreateFirstProfileId();
  if (profile.error || !profile.profileId) {
    return { ok: false, message: profile.error ?? "Unable to resolve profile id." };
  }

  const fileValue = formData.get("docx_file");
  const file = fileValue instanceof File ? fileValue : null;
  const validation = validateDocx(file);
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const originalFilename = file?.name ?? "resume-template.docx";
  const requestedName = getText(formData, "name");
  const isDefault = isChecked(formData, "is_default");

  const { data: created, error: createError } = await supabase
    .from("resume_templates")
    .insert({
      profile_id: profile.profileId,
      name: requestedName || originalFilename.replace(/\.docx$/i, ""),
      target_role: getText(formData, "target_role") || null,
      template_text: "",
      extracted_text: "",
      template_json: {},
      upload_source: "docx",
      original_filename: originalFilename,
      is_default: isDefault,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return { ok: false, message: createError?.message ?? "Unable to create resume template row." };
  }

  const fileBytes = new Uint8Array(await file!.arrayBuffer());
  const safeFilename = sanitizeFilename(originalFilename);
  const storagePath = `${profile.profileId}/${created.id}/${safeFilename}`;

  const { error: uploadError } = await supabase.storage
    .from(RESUME_TEMPLATE_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: DOCX_MIME,
      upsert: true,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message, id: created.id };
  }

  const extraction = await extractDocxText(fileBytes);

  const updatePayload = {
    original_filename: originalFilename,
    docx_storage_path: storagePath,
    extracted_text: extraction.text ?? "",
    template_text: extraction.text ?? "",
    upload_source: "docx",
  };

  const { error: updateError } = await supabase
    .from("resume_templates")
    .update(updatePayload)
    .eq("id", created.id);

  if (updateError) {
    return { ok: false, message: updateError.message, id: created.id };
  }

  if (isDefault) {
    const defaultError = await clearOtherDefaults(profile.profileId, created.id);
    if (defaultError) {
      return { ok: false, message: defaultError, id: created.id };
    }
  }

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${created.id}`);
  revalidatePath("/jobs");

  if (extraction.error) {
    return {
      ok: false,
      id: created.id,
      message: extraction.error,
    };
  }

  return {
    ok: true,
    id: created.id,
  };
}

export async function createManualResumeTemplate(formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to create manual templates.",
    };
  }

  const profile = await getOrCreateFirstProfileId();
  if (profile.error || !profile.profileId) {
    return { ok: false, message: profile.error ?? "Unable to resolve profile id." };
  }

  const name = getText(formData, "name");
  const templateText = getText(formData, "template_text");
  if (!name || !templateText) {
    return { ok: false, message: "Name and template text are required." };
  }

  const templateJson = parseTemplateJson(getText(formData, "template_json"));
  if (templateJson.error) {
    return { ok: false, message: templateJson.error };
  }

  const isDefault = isChecked(formData, "is_default");

  const { data, error } = await supabase
    .from("resume_templates")
    .insert({
      profile_id: profile.profileId,
      name,
      target_role: getText(formData, "target_role") || null,
      template_text: templateText,
      extracted_text: "",
      template_json: templateJson.value ?? {},
      upload_source: "manual",
      is_default: isDefault,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Unable to create manual template." };
  }

  if (isDefault) {
    const defaultError = await clearOtherDefaults(profile.profileId, data.id);
    if (defaultError) {
      return { ok: false, message: defaultError, id: data.id };
    }
  }

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${data.id}`);
  revalidatePath("/jobs");
  return { ok: true, id: data.id };
}

export async function setDefaultResumeTemplate(id: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to set a default template.",
    };
  }

  const { data: target, error: readError } = await supabase
    .from("resume_templates")
    .select("id, profile_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !target) {
    return { ok: false, message: readError?.message ?? "Resume template not found." };
  }

  const { error: setError } = await supabase
    .from("resume_templates")
    .update({ is_default: true })
    .eq("id", id);

  if (setError) {
    return { ok: false, message: setError.message };
  }

  const defaultError = await clearOtherDefaults(target.profile_id, id);
  if (defaultError) {
    return { ok: false, message: defaultError };
  }

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${id}`);
  revalidatePath("/jobs");
  return { ok: true };
}

export async function deleteResumeTemplate(id: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to delete templates.",
    };
  }

  const { data: existing, error: readError } = await supabase
    .from("resume_templates")
    .select("docx_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return { ok: false, message: readError.message };
  }

  if (existing?.docx_storage_path) {
    await supabase.storage.from(RESUME_TEMPLATE_BUCKET).remove([existing.docx_storage_path]);
  }

  const { error } = await supabase.from("resume_templates").delete().eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/resumes");
  revalidatePath("/jobs");
  return { ok: true };
}
