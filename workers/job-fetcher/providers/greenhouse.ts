// Greenhouse job board provider.
//
// Fetches public postings from the Greenhouse boards API and normalizes them
// into the shared NormalizedJobPosting shape.

import { ensureAbsoluteUrl, normalizeWhitespace, stripHtml, toNullableString } from "../normalizers";
import type { JobSourceConfig, NormalizedJobPosting } from "../types";

type GreenhouseOffice = { name?: string | null };

type GreenhouseJob = {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  content?: string;
  location?: { name?: string | null } | null;
  offices?: GreenhouseOffice[] | null;
};

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
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

function resolveLocation(job: GreenhouseJob): string | null {
  const direct = toNullableString(job.location?.name);
  if (direct) {
    return direct;
  }
  const office = job.offices?.find((entry) => toNullableString(entry?.name));
  return toNullableString(office?.name);
}

export function normalizeGreenhouseJobs(
  source: JobSourceConfig,
  jobs: GreenhouseJob[],
): NormalizedJobPosting[] {
  const company = toNullableString(source.company_name) ?? toNullableString(source.name);

  return jobs
    .map((job): NormalizedJobPosting | null => {
      const title = toNullableString(job.title);
      const applyUrl = toNullableString(job.absolute_url);
      if (!title || !applyUrl) {
        return null;
      }

      const description = job.content ? stripHtml(job.content) : null;

      return {
        title: normalizeWhitespace(title),
        company,
        location: resolveLocation(job),
        salary: null,
        description: description && description.length > 0 ? description : null,
        apply_url: ensureAbsoluteUrl(applyUrl),
        source_job_id: job.id != null ? String(job.id) : null,
        raw: job,
      };
    })
    .filter((posting): posting is NormalizedJobPosting => posting !== null);
}

export async function fetchGreenhouseJobs(
  source: JobSourceConfig,
): Promise<NormalizedJobPosting[]> {
  const slug = resolveSlug(source);
  if (!slug) {
    throw new Error(
      `Greenhouse source "${source.name}" is missing a company_slug and none could be derived from its URL.`,
    );
  }

  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Greenhouse request failed (${response.status}) for slug "${slug}".`);
  }

  const data = (await response.json()) as GreenhouseResponse;
  return normalizeGreenhouseJobs(source, data.jobs ?? []);
}
