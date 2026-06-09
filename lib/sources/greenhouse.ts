export type ParsedGreenhouseSource = {
  sourceType: "greenhouse";
  sourceName: string;
  companyName: string;
  companySlug: string;
  canonicalUrl: string;
};

function toTitleCaseWord(value: string): string {
  if (!value) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1).toLowerCase();
}

function toCompanyNameFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => toTitleCaseWord(part))
    .join(" ");
}

export function parseGreenhouseSourceFromUrl(rawUrl: string): ParsedGreenhouseSource | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (host !== "boards.greenhouse.io" && host !== "job-boards.greenhouse.io") {
    return null;
  }

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  const rawSlug = pathSegments[0]?.trim();
  if (!rawSlug) {
    return null;
  }

  const normalizedSlug = rawSlug.toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalizedSlug)) {
    return null;
  }

  const companyName = toCompanyNameFromSlug(normalizedSlug);
  if (!companyName) {
    return null;
  }

  return {
    sourceType: "greenhouse",
    sourceName: `Greenhouse - ${companyName}`,
    companyName,
    companySlug: normalizedSlug,
    canonicalUrl: `https://boards.greenhouse.io/${encodeURIComponent(normalizedSlug)}`,
  };
}
