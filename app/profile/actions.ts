"use server";

import { revalidatePath } from "next/cache";

import {
  fromCommaSeparated,
  parseJsonArray,
  parseJsonObject,
} from "@/lib/profile-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; message?: string };

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseNullableInt(value: string): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function saveProfile(formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Supabase is not configured. Add environment variables to save profile data.",
    };
  }

  const workHistory = parseJsonArray(getText(formData, "work_history"), "Work history");
  if (workHistory.error) {
    return { ok: false, message: workHistory.error };
  }

  const education = parseJsonArray(getText(formData, "education"), "Education");
  if (education.error) {
    return { ok: false, message: education.error };
  }

  const certifications = parseJsonArray(getText(formData, "certifications"), "Certifications");
  if (certifications.error) {
    return { ok: false, message: certifications.error };
  }

  const projects = parseJsonArray(getText(formData, "projects"), "Projects");
  if (projects.error) {
    return { ok: false, message: projects.error };
  }

  const preferences = parseJsonObject(getText(formData, "preferences"), "Preferences");
  if (preferences.error) {
    return { ok: false, message: preferences.error };
  }

  const payload = {
    name: getText(formData, "name") || null,
    email: getText(formData, "email") || null,
    phone: getText(formData, "phone") || null,
    location: getText(formData, "location") || null,
    linkedin_url: getText(formData, "linkedin_url") || null,
    portfolio_url: getText(formData, "portfolio_url") || null,
    github_url: getText(formData, "github_url") || null,
    target_titles: fromCommaSeparated(getText(formData, "target_titles")),
    target_locations: fromCommaSeparated(getText(formData, "target_locations")),
    min_salary: parseNullableInt(getText(formData, "min_salary")),
    remote_preference: getText(formData, "remote_preference") || null,
    skills: fromCommaSeparated(getText(formData, "skills")),
    summary: getText(formData, "summary") || null,
    resume_text: getText(formData, "resume_text") || null,
    work_history: workHistory.value ?? [],
    education: education.value ?? [],
    certifications: certifications.value ?? [],
    projects: projects.value ?? [],
    preferences: preferences.value ?? {},
  };

  const submittedId = getText(formData, "id");
  let profileId = submittedId;
  if (!profileId) {
    const { data } = await supabase
      .from("user_profiles")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    profileId = data?.id ?? "";
  }

  const { error } = profileId
    ? await supabase.from("user_profiles").update(payload).eq("id", profileId)
    : await supabase.from("user_profiles").insert(payload);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/jobs");
  return { ok: true };
}
