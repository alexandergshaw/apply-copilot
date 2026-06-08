import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import type { ExtractedJobPosting, ExtractionSource } from "@/lib/job-import";

export const PARTIAL_EXTRACTION_WARNING =
  "Some fields could not be extracted. Please review and fill them in manually.";

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

function pickFirstText(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const normalized = candidate ? normalizeWhitespace(candidate) : "";
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function isLikelyRichDescription(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizeWhitespace(value);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (normalized.length < 30 || wordCount < 5) {
    return false;
  }

  return /\s/.test(normalized) && /[.!?]/.test(normalized);
}

function cleanDocumentTitle(value: string | null): string | null {
  const title = toTrimmedString(value);
  if (!title) {
    return null;
  }

  return title
    .replace(/^Job Application for\s+/i, "")
    .replace(/\s+at\s+[^|\-–]+$/i, "")
    .trim();
}

function inferCompanyFromTitle(value: string | null): string | null {
  const title = toTrimmedString(value);
  if (!title) {
    return null;
  }

  const match = title.match(/\s+at\s+([^|\-–]+)$/i);
  if (!match) {
    return null;
  }

  return toTrimmedString(match[1]);
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

  const normalizedDescription = toTrimmedString(description);

  return {
    title: title ?? "",
    company: null,
    location: null,
    salary: null,
    description: isLikelyRichDescription(normalizedDescription) ? normalizedDescription : null,
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

  const documentTitle = $("title").first().text();
  const title =
    pickFirstText([
      $("h1").first().text(),
      $("meta[property='og:title']").attr("content"),
      cleanDocumentTitle(documentTitle),
    ]) ?? "";

  const prioritizedSelectors = [
    ".job__description",
    ".opening__description",
    "[data-qa='job-description']",
    "[class*='job-description']",
    "[class*='description']",
    "article",
    "main",
    "[data-testid*='job']",
    "[class*='job']",
  ];

  const descriptionCandidates: Array<string | null> = prioritizedSelectors.map((selector) => {
    const first = $(selector).first();
    if (first.length === 0) {
      return null;
    }

    return extractReadableTextFromNode($, first);
  });

  const preferredDescription = descriptionCandidates.find((candidate) =>
    isLikelyRichDescription(candidate),
  );

  if (descriptionCandidates.length === 0) {
    descriptionCandidates.push(extractReadableTextFromNode($, $("body")));
  }

  const company = pickFirstText([
    $("[data-qa='company-name']").first().text(),
    $("[class*='company-name']").first().text(),
    $("[data-testid*='company']").first().text(),
    $("[class*='company']").first().text(),
    $("meta[property='og:site_name']").attr("content"),
    inferCompanyFromTitle(documentTitle),
  ]);
  const location = pickFirstText([
    $(".job__location").first().text(),
    $("[data-testid*='location']").first().text(),
    $("[class*='location']").first().text(),
    $("meta[property='og:description']").attr("content"),
  ]);

  return {
    title,
    company,
    location,
    salary: null,
    description: preferredDescription ?? pickBestText(descriptionCandidates),
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

export function extractJobPostingFromHtml(
  html: string,
  submittedUrl: string,
): ExtractedJobPosting | null {
  const $ = cheerio.load(html);

  const fromJsonLd = extractedFromJsonLd($, submittedUrl);
  if (fromJsonLd) {
    return mergeWarnings(fromJsonLd, "json_ld");
  }

  const fromMeta = extractedFromMeta($, submittedUrl);
  if (fromMeta && fromMeta.description) {
    return mergeWarnings(fromMeta, "meta");
  }

  return mergeWarnings(extractedFromHtml($, submittedUrl), "html_fallback");
}
