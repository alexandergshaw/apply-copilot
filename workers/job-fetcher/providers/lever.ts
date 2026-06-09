// Lever job board provider.
//
// Fetches public postings from the Lever postings API and normalizes them
// into the shared NormalizedJobPosting shape.

import {
  ensureAbsoluteUrl,
  normalizeSalary,
  normalizeWhitespace,
  stripHtml,
  toNullableString,
} from "../normalizers";
import type { JobSourceConfig, NormalizedJobPosting } from "../types";

type LeverPosting = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  description?: string;
  salaryRange?: unknown;
  categories?: {
    location?: string | null;
    [key: string]: unknown;
  } | null;
};

function resolveSlug(source: JobSourceConfig): string | null {
  if (source.company_slug && source.company_slug.trim()) {
    return source.company_slug.trim();
  }
  try {
    const segments = new URL(source.url).pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[0] : null;
  } catch {
    return null;
  }
}

export function normalizeLeverJobs(
  source: JobSourceConfig,
  postings: LeverPosting[],
): NormalizedJobPosting[] {
  const company = toNullableString(source.company_name) ?? toNullableString(source.name);

  return postings
    .map((posting): NormalizedJobPosting | null => {
      const title = toNullableString(posting.text);
      const applyUrl = toNullableString(posting.hostedUrl) ?? toNullableString(posting.applyUrl);
      if (!title || !applyUrl) {
        return null;
      }

      const descriptionSource =
        toNullableString(posting.descriptionPlain) ??
        (posting.description ? stripHtml(posting.description) : null);

      return {
        title: normalizeWhitespace(title),
        company,
        location: toNullableString(posting.categories?.location),
        salary: normalizeSalary(posting.salaryRange),
        description:
          descriptionSource && descriptionSource.length > 0 ? descriptionSource : null,
        apply_url: ensureAbsoluteUrl(applyUrl),
        source_job_id: toNullableString(posting.id),
        raw: posting,
      };
    })
    .filter((posting): posting is NormalizedJobPosting => posting !== null);
}

export async function fetchLeverJobs(source: JobSourceConfig): Promise<NormalizedJobPosting[]> {
  const slug = resolveSlug(source);
  if (!slug) {
    throw new Error(
      `Lever source "${source.name}" is missing a company_slug and none could be derived from its URL.`,
    );
  }

  const endpoint = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Lever request failed (${response.status}) for slug "${slug}".`);
  }

  const data = (await response.json()) as LeverPosting[];
  return normalizeLeverJobs(source, Array.isArray(data) ? data : []);
}
