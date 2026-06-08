"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; message?: string };

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isChecked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function parseResumeJson(rawText: string): { value?: Record<string, unknown>; error?: string } {
  const text = rawText || "{}";

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Resume JSON must be a JSON object." };
    }

    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: "Resume JSON contains invalid JSON." };
  }
}

export async function updateResumeVersion(id: number, formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to update resume versions.",
    };
  }

  const name = getText(formData, "name");
  const resumeText = getText(formData, "resume_text");

  if (!name || !resumeText) {
    return { ok: false, message: "Name and Resume text are required." };
  }

  const resumeJson = parseResumeJson(getText(formData, "resume_json"));
  if (resumeJson.error) {
    return { ok: false, message: resumeJson.error };
  }

  const isDefault = isChecked(formData, "is_default");

  if (isDefault) {
    const { data: current, error: currentError } = await supabase
      .from("resume_versions")
      .select("profile_id")
      .eq("id", id)
      .maybeSingle();

    if (currentError || !current) {
      return { ok: false, message: currentError?.message ?? "Resume version not found." };
    }

    const { error: unsetError } = await supabase
      .from("resume_versions")
      .update({ is_default: false })
      .eq("profile_id", current.profile_id)
      .neq("id", id);

    if (unsetError) {
      return { ok: false, message: unsetError.message };
    }
  }

  const { error } = await supabase
    .from("resume_versions")
    .update({
      name,
      target_role: getText(formData, "target_role") || null,
      resume_text: resumeText,
      resume_json: resumeJson.value ?? {},
      is_default: isDefault,
    })
    .eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/resumes");
  revalidatePath(`/resumes/${id}`);
  revalidatePath("/jobs");
  return { ok: true };
}
