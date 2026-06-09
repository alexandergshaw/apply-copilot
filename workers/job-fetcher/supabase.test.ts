import { describe, expect, it } from "vitest";

import { upsertNormalizedJobs, type WorkerSupabaseClient } from "./supabase";
import type { JobSourceConfig, NormalizedJobPosting } from "./types";

const source: JobSourceConfig = {
  id: 7,
  name: "Example Source",
  source_type: "greenhouse",
  url: "https://boards.greenhouse.io/example",
  company_name: "Example Co",
  company_slug: "example",
  last_run_at: null,
  fetch_interval_minutes: null,
  remote_only: true,
  posted_within_days: 1,
  enabled: true,
};

function makePosting(overrides: Partial<NormalizedJobPosting>): NormalizedJobPosting {
  return {
    title: "Engineer",
    company: "Example Co",
    location: "Remote",
    salary: null,
    description: "Build things.",
    apply_url: "https://example.com/jobs/1",
    source_job_id: null,
    raw: {},
    ...overrides,
  };
}

type ExistingRow = { id: number; apply_url: string };

function makeClient(existing: ExistingRow[]) {
  const inserted: Array<Record<string, unknown>> = [];
  const updated: Array<{ id: number; values: Record<string, unknown> }> = [];
  const inCalls: string[][] = [];

  const client = {
    from() {
      return {
        select() {
          return {
            in: async (_column: string, values: string[]) => {
              inCalls.push(values);
              const valueSet = new Set(values);
              return {
                data: existing.filter((row) => valueSet.has(row.apply_url)),
                error: null,
              };
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq: async (_column: string, id: number) => {
              updated.push({ id, values });
              return { error: null };
            },
          };
        },
        insert(values: Record<string, unknown>) {
          inserted.push(values);
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as WorkerSupabaseClient;

  return { client, inserted, updated, inCalls };
}

describe("upsertNormalizedJobs", () => {
  it("skips postings missing a title or apply_url", async () => {
    const { client, inserted } = makeClient([]);
    const summary = await upsertNormalizedJobs(client, source, [
      makePosting({ apply_url: "https://example.com/jobs/valid" }),
      makePosting({ apply_url: "" }),
      makePosting({ title: "", apply_url: "https://example.com/jobs/no-title" }),
    ]);

    expect(summary.jobsFound).toBe(3);
    expect(summary.jobsInserted).toBe(1);
    expect(summary.jobsSkipped).toBe(2);
    expect(inserted).toHaveLength(1);
  });

  it("updates existing jobs instead of duplicating by apply_url", async () => {
    const { client, inserted, updated } = makeClient([
      { id: 5, apply_url: "https://example.com/jobs/a" },
    ]);

    const summary = await upsertNormalizedJobs(client, source, [
      makePosting({ apply_url: "https://example.com/jobs/a" }),
      makePosting({ apply_url: "https://example.com/jobs/b" }),
    ]);

    expect(summary.jobsUpdated).toBe(1);
    expect(summary.jobsInserted).toBe(1);
    expect(updated).toEqual([
      expect.objectContaining({ id: 5 }),
    ]);
    expect(inserted).toHaveLength(1);
    // Status is never overwritten on update.
    expect(updated[0].values).not.toHaveProperty("status");
  });

  it("deduplicates repeated apply_urls within a single batch", async () => {
    const { client, inserted } = makeClient([]);
    const summary = await upsertNormalizedJobs(client, source, [
      makePosting({ apply_url: "https://example.com/jobs/dupe" }),
      makePosting({ apply_url: "https://example.com/jobs/dupe" }),
    ]);

    expect(summary.jobsInserted).toBe(1);
    expect(summary.jobsSkipped).toBe(1);
    expect(inserted).toHaveLength(1);
  });

  it("chunks apply_url lookup queries for large batches", async () => {
    const postings = Array.from({ length: 450 }, (_, index) =>
      makePosting({
        apply_url: `https://example.com/jobs/${index}`,
      }),
    );

    const { client, inCalls } = makeClient([]);
    const summary = await upsertNormalizedJobs(client, source, postings);

    expect(summary.jobsFound).toBe(450);
    expect(summary.jobsInserted).toBe(450);
    expect(inCalls).toHaveLength(3);
    expect(inCalls[0]).toHaveLength(200);
    expect(inCalls[1]).toHaveLength(200);
    expect(inCalls[2]).toHaveLength(50);
  });
});
