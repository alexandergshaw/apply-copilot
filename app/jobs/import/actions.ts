"use server";

import { lookup } from "node:dns/promises";

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/actions";
import type { ExtractedJobPosting, ExtractionSource } from "@/lib/job-import";
import { getMissingSupabaseEnvVars } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const VALID_JOB_STATUSES = new Set(["found", "saved", "applied", "rejected"]);
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_USER_AGENT =
  "Mozilla/5.0 (compatible; ApplyCopilot/1.0; +https://github.com/alexandergshaw/apply-copilot)";
const PARTIAL_EXTRACTION_WARNING =
  "Some fields could not be extracted. Please review and fill them in manually.";
const PRIVATE_HOST_LABELS = ["localhost", "local", "internal", "home", "lan"];

type FetchJobResult = ActionResult & {
  data?: ExtractedJobPosting;
};

function getTextField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toNullableText(value: string): string | null {
  return value ? value : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function stripTags(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized ? normalized : null;
}

function resolveUrlCandidate(value: unknown, baseUrl: string): string | null {
  const raw = toTrimmedString(value);
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw, baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
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

function removeNoise(root: cheerio.Cheerio<AnyNode>) {
  root.find("script, style, noscript, nav, footer, aside, iframe, svg, form").remove();
  root
    .find(
      "[id*='cookie'], [class*='cookie'], [id*='consent'], [class*='consent'], [id*='banner'], [class*='banner']",
    )
    .remove();
}

function extractReadableTextFromNode(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
): string | null {
  const clone = root.clone();
  removeNoise(clone);

  const paragraphs: string[] = [];
  clone.find("p, li, h2, h3").each((_, element) => {
    const text = normalizeWhitespace($(element).text());
    if (text && text.length > 24) {
      paragraphs.push(text);
    }
  });

  const body = paragraphs.length > 0 ? paragraphs.join("\n\n") : normalizeWhitespace(clone.text());
  return body || null;
}

function pickBestText(candidates: Array<string | null | undefined>): string | null {
  const values = candidates
    .map((value) => (value ? normalizeWhitespace(value) : ""))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  return values[0] ?? null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function flattenJsonLdCandidates(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== "object") {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((item) => flattenJsonLdCandidates(item));
  }

  const asRecord = node as Record<string, unknown>;
  const graph = asRecord["@graph"];
  if (Array.isArray(graph)) {
    return graph.flatMap((item) => flattenJsonLdCandidates(item));
  }

  return [asRecord];
}

function isJobPostingNode(node: Record<string, unknown>): boolean {
  const typeValue = node["@type"];
  const normalized = Array.isArray(typeValue)
    ? typeValue.map((value) => String(value).toLowerCase())
    : [String(typeValue ?? "").toLowerCase()];

  return normalized.includes("jobposting");
}

function extractLocation(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return toTrimmedString(value);
  }

  if (Array.isArray(value)) {
    return pickBestText(value.map((item) => extractLocation(item)));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const address = record.address;
    if (typeof address === "string") {
      return toTrimmedString(address);
    }

    if (address && typeof address === "object") {
      const addressRecord = address as Record<string, unknown>;
      return pickBestText([
        toTrimmedString(addressRecord.streetAddress),
        toTrimmedString(addressRecord.addressLocality),
        toTrimmedString(addressRecord.addressRegion),
        toTrimmedString(addressRecord.addressCountry),
      ]);
    }
  }

  return null;
}

function extractSalary(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return toTrimmedString(value);
  }

  if (typeof value === "number") {
    return `${value}`;
  }

  if (Array.isArray(value)) {
    return pickBestText(value.map((item) => extractSalary(item)));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nestedValue = record.value;
    if (nestedValue && typeof nestedValue === "object") {
      const nestedRecord = nestedValue as Record<string, unknown>;
      const minValue = toTrimmedString(nestedRecord.minValue);
      const maxValue = toTrimmedString(nestedRecord.maxValue);
      const unitText = toTrimmedString(nestedRecord.unitText);
      const currency = toTrimmedString(record.currency) ?? toTrimmedString(nestedRecord.currency);

      if (minValue || maxValue) {
        const range = maxValue ? `${minValue ?? ""}-${maxValue}` : (minValue ?? "");
        return normalizeWhitespace(`${currency ?? ""} ${range} ${unitText ?? ""}`);
      }

      return pickBestText([
        toTrimmedString(nestedRecord.value),
        toTrimmedString(nestedRecord.unitText),
      ]);
    }

    return pickBestText([
      toTrimmedString(record.value),
      toTrimmedString(record.minValue),
      toTrimmedString(record.maxValue),
      toTrimmedString(record.unitText),
    ]);
  }

  return null;
}

function extractedFromJsonLd(
  $: cheerio.CheerioAPI,
  submittedUrl: string,
): ExtractedJobPosting | null {
  const scripts = $("script[type='application/ld+json']");
  for (let index = 0; index < scripts.length; index += 1) {
    const scriptBody = $(scripts[index]).html();
    if (!scriptBody) {
      continue;
    }

    const parsed = parseJson(scriptBody);
    const jobNode = flattenJsonLdCandidates(parsed).find((node) => isJobPostingNode(node));
    if (!jobNode) {
      continue;
    }

    const title = toTrimmedString(jobNode.title) ?? "";
    const description = toTrimmedString(stripTags(String(jobNode.description ?? "")));
    const company =
      typeof jobNode.hiringOrganization === "object" && jobNode.hiringOrganization
        ? toTrimmedString((jobNode.hiringOrganization as Record<string, unknown>).name)
        : null;
    const location = extractLocation(jobNode.jobLocation);
    const salary = extractSalary(jobNode.baseSalary);
    const extractedUrl =
      resolveUrlCandidate(jobNode.url, submittedUrl) ??
      resolveUrlCandidate(jobNode.sameAs, submittedUrl) ??
      submittedUrl;

    return {
      title,
      company,
      location,
      salary,
      description,
      apply_url: extractedUrl,
      extraction_source: "json_ld",
      warnings: [],
    };
  }

  return null;
}

function extractedFromMeta($: cheerio.CheerioAPI, submittedUrl: string): ExtractedJobPosting | null {
  const title = pickBestText([
    $("meta[property='og:title']").attr("content"),
    $("meta[name='twitter:title']").attr("content"),
    $("title").first().text(),
  ]);

  const description = pickBestText([
    $("meta[property='og:description']").attr("content"),
    $("meta[name='twitter:description']").attr("content"),
    $("meta[name='description']").attr("content"),
  ]);

  if (!title && !description) {
    return null;
  }

  return {
    title: title ?? "",
    company: null,
    location: null,
    salary: null,
    description,
    apply_url:
      resolveUrlCandidate($("meta[property='og:url']").attr("content"), submittedUrl) ??
      resolveUrlCandidate($("link[rel='canonical']").attr("href"), submittedUrl) ??
      submittedUrl,
    extraction_source: "meta",
    warnings: [],
  };
}

function extractedFromHtml($: cheerio.CheerioAPI, submittedUrl: string): ExtractedJobPosting {
  removeNoise($.root());

  const title = pickBestText([$("h1").first().text(), $("title").first().text()]) ?? "";

  const descriptionCandidates: Array<string | null> = [];
  [
    "[data-testid*='job']",
    "[class*='job']",
    "[class*='description']",
    "main",
    "article",
  ].forEach((selector) => {
    const first = $(selector).first();
    if (first.length > 0) {
      descriptionCandidates.push(extractReadableTextFromNode($, first));
    }
  });

  if (descriptionCandidates.length === 0) {
    descriptionCandidates.push(extractReadableTextFromNode($, $("body")));
  }

  const company = pickBestText([
    $(`[data-testid*='company']`).first().text(),
    $(`[class*='company']`).first().text(),
  ]);
  const location = pickBestText([
    $(`[data-testid*='location']`).first().text(),
    $(`[class*='location']`).first().text(),
  ]);

  return {
    title,
    company,
    location,
    salary: null,
    description: pickBestText(descriptionCandidates),
    apply_url: submittedUrl,
    extraction_source: "html_fallback",
    warnings: [],
  };
}

function mergeWarnings(
  extracted: ExtractedJobPosting,
  extractionSource: ExtractionSource,
): ExtractedJobPosting {
  const warnings = [...extracted.warnings];
  if (!extracted.title || !extracted.description) {
    warnings.push(PARTIAL_EXTRACTION_WARNING);
  }

  return {
    ...extracted,
    extraction_source: extractionSource,
    warnings: Array.from(new Set(warnings)),
  };
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
  const $ = cheerio.load(html);
  const submittedUrl = parsedUrl.toString();

  const fromJsonLd = extractedFromJsonLd($, submittedUrl);
  if (fromJsonLd) {
    return { ok: true, data: mergeWarnings(fromJsonLd, "json_ld") };
  }

  const fromMeta = extractedFromMeta($, submittedUrl);
  if (fromMeta) {
    return { ok: true, data: mergeWarnings(fromMeta, "meta") };
  }

  const fromHtml = mergeWarnings(extractedFromHtml($, submittedUrl), "html_fallback");
  if (!fromHtml.title && !fromHtml.description) {
    return {
      ok: false,
      message: "No usable job data found at this URL. Please paste details manually.",
    };
  }

  return { ok: true, data: fromHtml };
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

  const { error } = await supabase.from("jobs").insert({
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
