// Normalization utilities shared by the job board providers.

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  let result = value;
  for (const [entity, replacement] of Object.entries(NAMED_ENTITIES)) {
    result = result.split(entity).join(replacement);
  }
  // Numeric entities (decimal and hex).
  result = result.replace(/&#(\d+);/g, (_, code: string) =>
    String.fromCodePoint(Number.parseInt(code, 10)),
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
    String.fromCodePoint(Number.parseInt(code, 16)),
  );
  return result;
}

/**
 * Collapse all runs of whitespace into single spaces and trim the result.
 */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Remove HTML tags from a string, decode common entities, and normalize
 * whitespace. Block-level tags are converted to newlines so paragraphs are
 * not glued together. Entity-encoded markup (e.g. Greenhouse `content`) is
 * handled by decoding before and after tag removal.
 */
export function stripHtml(html: string): string {
  if (!html) {
    return "";
  }

  // Decode first so entity-encoded tags (&lt;p&gt;) become real tags.
  const withBreaks = decodeEntities(html)
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "");

  const decoded = decodeEntities(withBreaks);

  return decoded
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

/**
 * Coerce an unknown value into a trimmed string, or null when empty/invalid.
 */
export function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

/**
 * Best-effort normalization of a salary value into a display string.
 * Accepts plain strings/numbers or objects shaped like { min, max, currency }.
 */
export function normalizeSalary(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return toNullableString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const currency = toNullableString(record.currency) ?? "";
    const min = record.min ?? record.minValue ?? record.minimum;
    const max = record.max ?? record.maxValue ?? record.maximum;
    const interval = toNullableString(record.interval ?? record.period);

    const minStr = typeof min === "number" || typeof min === "string" ? String(min) : null;
    const maxStr = typeof max === "number" || typeof max === "string" ? String(max) : null;

    let range: string | null = null;
    if (minStr && maxStr) {
      range = `${minStr} - ${maxStr}`;
    } else if (minStr) {
      range = minStr;
    } else if (maxStr) {
      range = maxStr;
    }

    if (!range) {
      return null;
    }

    const prefix = currency ? `${currency} ` : "";
    const suffix = interval ? ` / ${interval}` : "";
    return normalizeWhitespace(`${prefix}${range}${suffix}`);
  }

  return null;
}

/**
 * Ensure a URL is absolute. Protocol-relative URLs are upgraded to https and
 * obviously-relative values are returned unchanged (callers should validate).
 */
export function ensureAbsoluteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return trimmed;
}
