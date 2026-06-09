import { describe, expect, it } from "vitest";

import {
  ensureAbsoluteUrl,
  normalizeSalary,
  normalizeWhitespace,
  stripHtml,
  toNullableString,
} from "./normalizers";
import { normalizeAshbyJobs } from "./providers/ashby";
import { normalizeGreenhouseJobs } from "./providers/greenhouse";
import { normalizeLeverJobs } from "./providers/lever";
import type { JobSourceConfig } from "./types";

function makeSource(source_type: JobSourceConfig["source_type"]): JobSourceConfig {
  return {
    id: 1,
    name: "Example Source",
    source_type,
    url: `https://example.com/${source_type}/example`,
    company_name: "Example Co",
    company_slug: "example",
    last_run_at: null,
    fetch_interval_minutes: null,
    remote_only: true,
    posted_within_days: 1,
    enabled: true,
  };
}

describe("normalizers", () => {
  it("stripHtml removes tags and decodes entities", () => {
    expect(stripHtml("<p>Build &amp; <strong>ship</strong>.</p>")).toBe("Build & ship.");
  });

  it("stripHtml handles entity-encoded markup (greenhouse content)", () => {
    expect(stripHtml("&lt;p&gt;Hello&lt;/p&gt;")).toBe("Hello");
  });

  it("stripHtml splits block elements into separate lines", () => {
    expect(stripHtml("<p>One</p><p>Two</p>")).toBe("One\nTwo");
  });

  it("normalizeWhitespace collapses runs of whitespace", () => {
    expect(normalizeWhitespace("a\n  b\t c")).toBe("a b c");
  });

  it("normalizeSalary handles strings and ranges", () => {
    expect(normalizeSalary("$120k")).toBe("$120k");
    expect(normalizeSalary({ min: 100000, max: 150000, currency: "USD" })).toBe(
      "USD 100000 - 150000",
    );
    expect(normalizeSalary(null)).toBeNull();
    expect(normalizeSalary({})).toBeNull();
  });

  it("ensureAbsoluteUrl upgrades protocol-relative URLs", () => {
    expect(ensureAbsoluteUrl("https://x.com/a")).toBe("https://x.com/a");
    expect(ensureAbsoluteUrl("//x.com/a")).toBe("https://x.com/a");
  });

  it("toNullableString trims and nullifies empty values", () => {
    expect(toNullableString("  hi ")).toBe("hi");
    expect(toNullableString("   ")).toBeNull();
    expect(toNullableString(undefined)).toBeNull();
    expect(toNullableString(42)).toBe("42");
  });
});

describe("greenhouse normalizer", () => {
  it("normalizes a sample payload", () => {
    const result = normalizeGreenhouseJobs(makeSource("greenhouse"), [
      {
        id: 123,
        title: "Senior Engineer",
        absolute_url: "https://boards.greenhouse.io/example/jobs/123",
        content: "&lt;p&gt;Build &amp; ship.&lt;/p&gt;",
        location: { name: "Remote" },
        offices: [{ name: "HQ" }],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Senior Engineer",
      company: "Example Co",
      location: "Remote",
      description: "Build & ship.",
      apply_url: "https://boards.greenhouse.io/example/jobs/123",
      source_job_id: "123",
    });
  });

  it("skips postings without a title or apply_url", () => {
    const result = normalizeGreenhouseJobs(makeSource("greenhouse"), [
      { id: 1, title: "No URL" },
      { id: 2, absolute_url: "https://x.com/a" },
    ]);
    expect(result).toHaveLength(0);
  });
});

describe("lever normalizer", () => {
  it("normalizes a sample payload", () => {
    const result = normalizeLeverJobs(makeSource("lever"), [
      {
        id: "abc",
        text: "Product Manager",
        hostedUrl: "https://jobs.lever.co/example/abc",
        descriptionPlain: "Lead products.",
        categories: { location: "NYC" },
        salaryRange: { min: 100000, max: 150000, currency: "USD" },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Product Manager",
      company: "Example Co",
      location: "NYC",
      salary: "USD 100000 - 150000",
      description: "Lead products.",
      apply_url: "https://jobs.lever.co/example/abc",
      source_job_id: "abc",
    });
  });
});

describe("ashby normalizer", () => {
  it("normalizes a sample payload", () => {
    const result = normalizeAshbyJobs(makeSource("ashby"), [
      {
        id: "job-1",
        title: "Designer",
        locationName: "Berlin",
        descriptionHtml: "<p>Design <strong>things</strong></p>",
        jobUrl: "https://jobs.ashbyhq.com/example/job-1",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Designer",
      company: "Example Co",
      location: "Berlin",
      description: "Design things",
      apply_url: "https://jobs.ashbyhq.com/example/job-1",
      source_job_id: "job-1",
    });
  });
});
