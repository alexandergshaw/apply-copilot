import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAshbyJobs } from "./ashby";
import { fetchGreenhouseJobs } from "./greenhouse";
import { fetchLeverJobs } from "./lever";
import type { JobSourceConfig } from "../types";

function makeSource(
  source_type: JobSourceConfig["source_type"],
  overrides: Partial<JobSourceConfig> = {},
): JobSourceConfig {
  return {
    id: 1,
    name: "Example",
    source_type,
    url: `https://example.com/${source_type}/acme`,
    company_name: "Example Inc",
    company_slug: "acme",
    last_run_at: null,
    last_auto_run_at: null,
    fetch_interval_minutes: null,
    remote_only: true,
    posted_within_days: 1,
    enabled: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchGreenhouseJobs", () => {
  it("calls the expected endpoint with company_slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobs: [
          {
            id: 1,
            title: "Backend Engineer",
            absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await fetchGreenhouseJobs(makeSource("greenhouse"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
      { headers: { accept: "application/json" } },
    );
    expect(jobs).toHaveLength(1);
  });

  it("derives slug from url when company_slug is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchGreenhouseJobs(
      makeSource("greenhouse", {
        company_slug: null,
        url: "https://boards.greenhouse.io/stripe",
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
      { headers: { accept: "application/json" } },
    );
  });

  it("throws when slug cannot be determined", async () => {
    await expect(
      fetchGreenhouseJobs(
        makeSource("greenhouse", {
          company_slug: null,
          url: "not-a-url",
        }),
      ),
    ).rejects.toThrow(/missing a company_slug/);
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    await expect(fetchGreenhouseJobs(makeSource("greenhouse"))).rejects.toThrow(
      /Greenhouse request failed \(404\)/,
    );
  });

  it("returns empty array when payload has no jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    await expect(fetchGreenhouseJobs(makeSource("greenhouse"))).resolves.toEqual([]);
  });
});

describe("fetchLeverJobs", () => {
  it("calls the expected endpoint with company_slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "1", text: "PM", hostedUrl: "https://jobs.lever.co/acme/1" },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await fetchLeverJobs(makeSource("lever"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.lever.co/v0/postings/acme?mode=json",
      { headers: { accept: "application/json" } },
    );
    expect(jobs).toHaveLength(1);
  });

  it("derives slug from first path segment when company_slug is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchLeverJobs(
      makeSource("lever", {
        company_slug: null,
        url: "https://jobs.lever.co/netlify/engineering",
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.lever.co/v0/postings/netlify?mode=json",
      { headers: { accept: "application/json" } },
    );
  });

  it("throws on missing slug", async () => {
    await expect(
      fetchLeverJobs(
        makeSource("lever", {
          company_slug: null,
          url: "also-not-a-url",
        }),
      ),
    ).rejects.toThrow(/missing a company_slug/);
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(fetchLeverJobs(makeSource("lever"))).rejects.toThrow(
      /Lever request failed \(500\)/,
    );
  });

  it("returns empty array for non-array payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ not: "array" }) }),
    );

    await expect(fetchLeverJobs(makeSource("lever"))).resolves.toEqual([]);
  });
});

describe("fetchAshbyJobs", () => {
  it("calls the expected endpoint with company_slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobs: [{ id: "1", title: "Designer", jobUrl: "https://jobs.ashbyhq.com/acme/1" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const jobs = await fetchAshbyJobs(makeSource("ashby"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.ashbyhq.com/posting-api/job-board/acme",
      { headers: { accept: "application/json" } },
    );
    expect(jobs).toHaveLength(1);
  });

  it("derives slug from last path segment when company_slug is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobs: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchAshbyJobs(
      makeSource("ashby", {
        company_slug: null,
        url: "https://api.ashbyhq.com/posting-api/job-board/figma",
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.ashbyhq.com/posting-api/job-board/figma",
      { headers: { accept: "application/json" } },
    );
  });

  it("throws on missing slug", async () => {
    await expect(
      fetchAshbyJobs(
        makeSource("ashby", {
          company_slug: null,
          url: "###",
        }),
      ),
    ).rejects.toThrow(/missing a company_slug/);
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );

    await expect(fetchAshbyJobs(makeSource("ashby"))).rejects.toThrow(
      /Ashby request failed \(429\)/,
    );
  });

  it("returns empty array when jobs field is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    await expect(fetchAshbyJobs(makeSource("ashby"))).resolves.toEqual([]);
  });
});