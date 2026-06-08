import { describe, expect, it } from "vitest";

import { mapJob, type JobRow } from "./types";

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
});
