"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/actions";
import { getMissingSupabaseEnvVars } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const VALID_JOB_STATUSES = new Set(["found", "saved", "applied", "rejected"]);

function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toNullableText(value: string): string | null {
  return value ? value : null;
}

function isChecked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function mapInsertErrorMessage(message: string, code?: string): string {
  if (code === "23505" && message.toLowerCase().includes("apply_url")) {
    return "A job with this apply URL already exists. Please use a different URL.";
  }
  return message;
}

export async function createManualJob(formData: FormData): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    const missingVars = getMissingSupabaseEnvVars();
    return {
      ok: false,
      message:
        missingVars.length > 0
          ? `Supabase is not configured. Missing: ${missingVars.join(", ")}. Set these in your deployment environment (or .env.local for local dev) and restart/redeploy.`
          : "Supabase is not configured. Add environment variables to save imported jobs.",
    };
  }

  const title = getTextField(formData, "title");
  if (!title) {
    return { ok: false, message: "Title is required." };
  }

  const submittedStatus = getTextField(formData, "status");
  const status = VALID_JOB_STATUSES.has(submittedStatus) ? submittedStatus : "found";

  const queueForAutoApply = isChecked(formData, "queue_for_auto_apply");

  const { error } = await supabase.from("jobs").insert({
    source_id: null,
    title,
    company: toNullableText(getTextField(formData, "company")),
    location: toNullableText(getTextField(formData, "location")),
    salary: toNullableText(getTextField(formData, "salary")),
    apply_url: toNullableText(getTextField(formData, "apply_url")),
    description: toNullableText(getTextField(formData, "description")),
    status,
    auto_apply_enabled: queueForAutoApply,
    auto_apply_status: queueForAutoApply ? "queued" : "not_requested",
    auto_apply_approved_at: queueForAutoApply ? new Date().toISOString() : null,
  });

  if (error) {
    return {
      ok: false,
      message: mapInsertErrorMessage(error.message, error.code),
    };
  }

  revalidatePath("/jobs");
  redirect("/jobs");
}
