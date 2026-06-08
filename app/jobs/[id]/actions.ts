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
    return { ok: false, message: jobError.message };
  }

  const { error: runError } = await supabase.from("auto_apply_runs").insert({
    job_id: numericId,
    status: "queued",
  });

  if (runError) {
    return { ok: false, message: runError.message };
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
    return { ok: false, message: error.message };
  }

  revalidateJobPaths(jobId);
  return { ok: true };
}
