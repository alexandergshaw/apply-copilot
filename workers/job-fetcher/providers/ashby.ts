// Ashby job board provider.
//
// Fetches public postings from the Ashby posting API and normalizes them
// into the shared NormalizedJobPosting shape.

import { ensureAbsoluteUrl, normalizeWhitespace, stripHtml, toNullableString } from "../normalizers";
import type { JobSourceConfig, NormalizedJobPosting } from "../types";

type AshbyJob = {
  id?: string;
  title?: string;
  location?: string | null;
  locationName?: string | null;
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applicationUrl?: string;
  applyUrl?: string;
};

type AshbyResponse = {
  jobs?: AshbyJob[];
};

function resolveSlug(source: JobSourceConfig): string | null {
  if (source.company_slug && source.company_slug.trim()) {
    return source.company_slug.trim();
  }
  try {
    const segments = new URL(source.url).pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : null;
  } catch {
    return null;
  }
}

export function normalizeAshbyJobs(
  source: JobSourceConfig,
  jobs: AshbyJob[],
): NormalizedJobPosting[] {
  const company = toNullableString(source.company_name) ?? toNullableString(source.name);

  return jobs
    .map((job): NormalizedJobPosting | null => {
      const title = toNullableString(job.title);
      const applyUrl =
        toNullableString(job.jobUrl) ??
        toNullableString(job.applicationUrl) ??
        toNullableString(job.applyUrl);
      if (!title || !applyUrl) {
        return null;
      }

      const description = job.descriptionHtml
        ? stripHtml(job.descriptionHtml)
        : toNullableString(job.descriptionPlain);

      return {
        title: normalizeWhitespace(title),
        company,
        location: toNullableString(job.locationName) ?? toNullableString(job.location),
        salary: null,
        description: description && description.length > 0 ? description : null,
        apply_url: ensureAbsoluteUrl(applyUrl),
        source_job_id: toNullableString(job.id),
        raw: job,
      };
    })
    .filter((posting): posting is NormalizedJobPosting => posting !== null);
}

export async function fetchAshbyJobs(source: JobSourceConfig): Promise<NormalizedJobPosting[]> {
  const slug = resolveSlug(source);
  if (!slug) {
    throw new Error(
      `Ashby source "${source.name}" is missing a company_slug and none could be derived from its URL.`,
    );
  }

  const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Ashby request failed (${response.status}) for slug "${slug}".`);
  }

  const data = (await response.json()) as AshbyResponse;
  return normalizeAshbyJobs(source, data.jobs ?? []);
}
