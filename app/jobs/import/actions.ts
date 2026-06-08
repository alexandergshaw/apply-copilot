"use server";

import { lookup } from "node:dns/promises";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/actions";
import { extractJobPostingFromHtml } from "@/lib/job-import/extract";
import type { ExtractedJobPosting } from "@/lib/job-import";
import { getMissingSupabaseEnvVars } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const VALID_JOB_STATUSES = new Set(["found", "saved", "applied", "rejected"]);
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_USER_AGENT =
  "Mozilla/5.0 (compatible; ApplyCopilot/1.0; +https://github.com/alexandergshaw/apply-copilot)";
const PRIVATE_HOST_LABELS = ["localhost", "local", "internal", "home", "lan"];

type FetchJobResult = ActionResult & {
  data?: ExtractedJobPosting;
};

type CreateManualJobResult = ActionResult & {
  canOverride?: boolean;
};

function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toNullableText(value: string): string | null {
  return value ? value : null;
}

function parseSubmittedUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (PRIVATE_HOST_LABELS.includes(normalized)) {
    return true;
  }

  if (normalized.endsWith(".local") || normalized.endsWith(".internal")) {
    return true;
  }

  return false;
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd");
}

async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  try {
    const results = await lookup(hostname, { all: true, verbatim: true });
    return results.some((result) =>
      result.family === 6 ? isPrivateIPv6(result.address) : isPrivateIPv4(result.address),
    );
  } catch {
    return false;
  }
}

async function isBlockedUrl(parsedUrl: URL): Promise<boolean> {
  const { hostname } = parsedUrl;

  if (isLocalHostname(hostname) || isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    return true;
  }

  return resolvesToPrivateAddress(hostname);
}

function isChecked(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function mapInsertErrorMessage(message: string, code?: string): string {
  if (code === "23505" && message.toLowerCase().includes("apply_url")) {
    return "A job with this apply URL already exists. Please use a different URL.";
  }

  if (code === "42501" || message.toLowerCase().includes("row-level security")) {
    return "Import failed because Supabase RLS blocked writes to jobs. Apply the latest migration that adds jobs policies, then retry.";
  }

  return "Unable to save this job right now. Please try again in a moment.";
}

function isDuplicateApplyUrlError(message: string, code?: string): boolean {
  return code === "23505" && message.toLowerCase().includes("apply_url");
}

export async function fetchJobFromUrl(formData: FormData): Promise<FetchJobResult> {
  const rawUrl = getTextField(formData, "url");
  const parsedUrl = parseSubmittedUrl(rawUrl);
  if (!parsedUrl) {
    return { ok: false, message: "Please enter a valid http(s) job URL." };
  }

  if (await isBlockedUrl(parsedUrl)) {
    return {
      ok: false,
      message: "This URL is not allowed. Please provide a public job posting URL.",
    };
  }

  let response: Response;
  try {
    response = await fetch(parsedUrl.toString(), {
      headers: {
        "user-agent": FETCH_USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      message:
        "We could not fetch that URL right now. The site may be blocked or unavailable. Try again or use manual paste.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: "We could not fetch that URL right now. The site blocked access or returned an error.",
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return {
      ok: false,
      message: "The URL did not return an HTML page. Please paste the job details manually.",
    };
  }

  const html = await response.text();
  const extracted = extractJobPostingFromHtml(html, parsedUrl.toString());
  if (!extracted || (!extracted.title && !extracted.description)) {
    return {
      ok: false,
      message: "No usable job data found at this URL. Please paste details manually.",
    };
  }

  return { ok: true, data: extracted };
}

export async function createManualJob(formData: FormData): Promise<CreateManualJobResult> {
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
  const submittedUrl = getTextField(formData, "submitted_url");
  const applyUrlInput = getTextField(formData, "apply_url");
  const applyUrl = applyUrlInput || submittedUrl;

  if (applyUrl) {
    const parsedApplyUrl = parseSubmittedUrl(applyUrl);
    if (!parsedApplyUrl) {
      return { ok: false, message: "Apply URL must be a valid http(s) URL." };
    }
  }

  const queueForAutoApply = isChecked(formData, "queue_for_auto_apply");
  const overrideExistingUrl = isChecked(formData, "override_existing_url");

  const payload = {
    source_id: null,
    title,
    company: toNullableText(getTextField(formData, "company")),
    location: toNullableText(getTextField(formData, "location")),
    salary: toNullableText(getTextField(formData, "salary")),
    apply_url: toNullableText(applyUrl),
    description: toNullableText(getTextField(formData, "description")),
    status,
    auto_apply_enabled: queueForAutoApply,
    auto_apply_status: queueForAutoApply ? "queued" : "not_requested",
    auto_apply_approved_at: queueForAutoApply ? new Date().toISOString() : null,
  };

  const { error } = await supabase.from("jobs").insert(payload);

  if (error) {
    if (overrideExistingUrl && applyUrl && isDuplicateApplyUrlError(error.message, error.code)) {
      const { error: updateError } = await supabase.from("jobs").update(payload).eq("apply_url", applyUrl);
      if (!updateError) {
        revalidatePath("/jobs");
        redirect("/jobs");
        return { ok: true };
      }

      return {
        ok: false,
        message: mapInsertErrorMessage(updateError.message, updateError.code),
      };
    }

    if (isDuplicateApplyUrlError(error.message, error.code)) {
      return {
        ok: false,
        canOverride: true,
        message:
          "A job with this apply URL already exists. Enable override to replace the existing job details.",
      };
    }

    return {
      ok: false,
      message: mapInsertErrorMessage(error.message, error.code),
    };
  }

  revalidatePath("/jobs");
  redirect("/jobs");
}
