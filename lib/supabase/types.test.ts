import { describe, expect, it } from "vitest";

import { mapJob, mapJobSource, type JobRow, type JobSourceRow } from "./types";

function createJobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: 101,
    source_id: 1,
    title: "Senior Product Manager",
    company: "NorthStar Health",
    location: "Remote",
    salary: null,
    description: "Lead product",
    apply_url: "https://example.com/northstar-health/senior-product-manager",
    status: "found",
    match_score: 90,
    match_reason: "Strong fit",
    auto_apply_enabled: false,
    auto_apply_approved_at: null,
    auto_apply_status: null,
    auto_apply_error: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

describe("mapJob apply_url mapping", () => {
  it("maps apply_url to applyUrl", () => {
    const job = mapJob(createJobRow());
    expect(job.applyUrl).toBe(
      "https://example.com/northstar-health/senior-product-manager",
    );
  });

  it("maps a missing apply_url to null", () => {
    const job = mapJob(createJobRow({ apply_url: null }));
    expect(job.applyUrl).toBeNull();
  });

  it("maps structured short_answers into readable drafts", () => {
    const job = mapJob({
      ...createJobRow(),
      application_packets: {
        id: 1,
        job_id: 101,
        tailored_resume: null,
        tailoring_notes: null,
        cover_letter: null,
        short_answers: [
          { question: "What is your full name?", answer: "Ada Lovelace" },
          { question: "Share your LinkedIn profile.", answer: "https://linkedin.com/in/ada" },
        ],
        risk_notes: null,
        created_at: null,
        updated_at: null,
      },
    });

    expect(job.shortAnswerDrafts).toEqual([
      "Q: What is your full name? A: Ada Lovelace",
      "Q: Share your LinkedIn profile. A: https://linkedin.com/in/ada",
    ]);
  });
});

describe("mapJobSource filter mapping", () => {
  it("maps remote_only and posted_within_days", () => {
    const source = mapJobSource({
      id: 1,
      name: "Acme",
      source_type: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      company_name: null,
      company_slug: null,
      fetch_interval_minutes: null,
      remote_only: false,
      posted_within_days: 3,
      enabled: true,
      last_run_at: null,
      last_auto_run_at: "2026-06-09T01:00:00.000Z",
      last_success_at: null,
      last_error: null,
      run_count: 0,
      created_at: null,
      updated_at: null,
    } satisfies JobSourceRow);

    expect(source.remoteOnly).toBe(false);
    expect(source.postedWithinDays).toBe(3);
    expect(source.lastAutoRunAt).toBe("2026-06-09T01:00:00.000Z");
  });

  it("uses defaults when filter columns are null", () => {
    const source = mapJobSource({
      id: 1,
      name: "Acme",
      source_type: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      company_name: null,
      company_slug: null,
      fetch_interval_minutes: null,
      remote_only: null,
      posted_within_days: null,
      enabled: true,
      last_run_at: null,
      last_auto_run_at: null,
      last_success_at: null,
      last_error: null,
      run_count: 0,
      created_at: null,
      updated_at: null,
    } satisfies JobSourceRow);

    expect(source.remoteOnly).toBe(true);
    expect(source.postedWithinDays).toBe(1);
  });
});
