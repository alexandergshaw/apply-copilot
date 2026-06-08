"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; message?: string; id?: number };

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isChecked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function parseResumeJson(formData: FormData): { value?: Record<string, unknown>; error?: string } {
  const raw = getText(formData, "resume_json") || "{}";

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Resume JSON must be a JSON object." };
    }
    return { value: parsed as Record<string, unknown> };
  } catch {
    return { error: "Resume JSON contains invalid JSON." };
  }
}

async function getOrCreateFirstProfileId(): Promise<{ profileId?: string; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      error: "Supabase is not configured. Add environment variables to save resume versions.",
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
    return { error: createError?.message ?? "Unable to create a profile for resume storage." };
  }

  return { profileId: created.id };
}

export async function createResumeVersion(formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to save resume versions.",
    };
  }

  const profile = await getOrCreateFirstProfileId();
  if (profile.error || !profile.profileId) {
    return { ok: false, message: profile.error ?? "Unable to resolve profile id." };
  }

  const name = getText(formData, "name");
  const resumeText = getText(formData, "resume_text");
  if (!name || !resumeText) {
    return { ok: false, message: "Name and Resume text are required." };
  }

  const resumeJson = parseResumeJson(formData);
  if (resumeJson.error) {
    return { ok: false, message: resumeJson.error };
  }

  const { data, error } = await supabase
    .from("resume_versions")
    .insert({
      profile_id: profile.profileId,
      name,
      target_role: getText(formData, "target_role") || null,
      resume_text: resumeText,
      resume_json: resumeJson.value ?? {},
      is_default: isChecked(formData, "is_default"),
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/resumes");
  revalidatePath("/jobs");
  return { ok: true, id: data.id };
}

export async function setDefaultResumeVersion(id: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to set a default resume.",
    };
  }

  const { data: target, error: readError } = await supabase
    .from("resume_versions")
    .select("id, profile_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !target) {
    return { ok: false, message: readError?.message ?? "Resume version not found." };
  }

  const { error: unsetError } = await supabase
    .from("resume_versions")
    .update({ is_default: false })
    .eq("profile_id", target.profile_id)
    .neq("id", id);

  if (unsetError) {
    return { ok: false, message: unsetError.message };
  }

  const { error: setError } = await supabase
    .from("resume_versions")
    .update({ is_default: true })
    .eq("id", id);

  if (setError) {
    return { ok: false, message: setError.message };
  }

  revalidatePath("/resumes");
  revalidatePath("/jobs");
  return { ok: true };
}

export async function deleteResumeVersion(id: number): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to delete resume versions.",
    };
  }

  const { error } = await supabase.from("resume_versions").delete().eq("id", id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/resumes");
  revalidatePath("/jobs");
  return { ok: true };
}
