import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JobSourceConfig, UpsertSummary } from "./types";

const mocked = vi.hoisted(() => ({
  mockFetchGreenhouseJobs: vi.fn(),
  mockFetchLeverJobs: vi.fn(),
  mockFetchAshbyJobs: vi.fn(),
  mockCreateServiceClient: vi.fn(),
  mockLoadEnabledJobSources: vi.fn(),
  mockLoadJobSourceById: vi.fn(),
  mockCreateFetchRun: vi.fn(),
  mockFinishFetchRun: vi.fn(),
  mockUpdateSourceAfterRun: vi.fn(),
  mockUpsertNormalizedJobs: vi.fn(),
}));

vi.mock("./providers/greenhouse", () => ({
  fetchGreenhouseJobs: mocked.mockFetchGreenhouseJobs,
}));

vi.mock("./providers/lever", () => ({
  fetchLeverJobs: mocked.mockFetchLeverJobs,
}));

vi.mock("./providers/ashby", () => ({
  fetchAshbyJobs: mocked.mockFetchAshbyJobs,
}));

vi.mock("./supabase", () => ({
  createServiceClient: mocked.mockCreateServiceClient,
  loadEnabledJobSources: mocked.mockLoadEnabledJobSources,
  loadJobSourceById: mocked.mockLoadJobSourceById,
  createFetchRun: mocked.mockCreateFetchRun,
  finishFetchRun: mocked.mockFinishFetchRun,
  updateSourceAfterRun: mocked.mockUpdateSourceAfterRun,
  upsertNormalizedJobs: mocked.mockUpsertNormalizedJobs,
}));

import {
  fetchAllEnabledJobSources,
  fetchJobsForSourceId,
  processSource,
} from "./fetch-all";

const sourceGreenhouse: JobSourceConfig = {
  id: 1,
  name: "Greenhouse Source",
  source_type: "greenhouse",
  url: "https://boards.greenhouse.io/acme",
  company_name: "Acme",
  company_slug: "acme",
  enabled: true,
};

const sourceLever: JobSourceConfig = {
  id: 2,
  name: "Lever Source",
  source_type: "lever",
  url: "https://jobs.lever.co/acme",
  company_name: "Acme",
  company_slug: "acme",
  enabled: true,
};

const sourceAshby: JobSourceConfig = {
  id: 3,
  name: "Ashby Source",
  source_type: "ashby",
  url: "https://api.ashbyhq.com/posting-api/job-board/acme",
  company_name: "Acme",
  company_slug: "acme",
  enabled: true,
};

const summary: UpsertSummary = {
  jobsFound: 3,
  jobsInserted: 1,
  jobsUpdated: 1,
  jobsSkipped: 1,
};

beforeEach(() => {
  Object.values(mocked).forEach((fn) => fn.mockReset());

  mocked.mockCreateServiceClient.mockReturnValue({});
  mocked.mockCreateFetchRun.mockResolvedValue(99);
  mocked.mockFinishFetchRun.mockResolvedValue(undefined);
  mocked.mockUpdateSourceAfterRun.mockResolvedValue(undefined);
  mocked.mockUpsertNormalizedJobs.mockResolvedValue(summary);

  mocked.mockFetchGreenhouseJobs.mockResolvedValue([{ apply_url: "https://x/1", title: "T" }]);
  mocked.mockFetchLeverJobs.mockResolvedValue([{ apply_url: "https://x/2", title: "T" }]);
  mocked.mockFetchAshbyJobs.mockResolvedValue([{ apply_url: "https://x/3", title: "T" }]);

  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("processSource", () => {
  it("returns failed when creating run fails", async () => {
    mocked.mockCreateFetchRun.mockRejectedValueOnce(new Error("db down"));

    const result = await processSource({} as never, sourceGreenhouse);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("db down");
    expect(result.summary).toEqual({
      jobsFound: 0,
      jobsInserted: 0,
      jobsUpdated: 0,
      jobsSkipped: 0,
    });
    expect(mocked.mockFinishFetchRun).not.toHaveBeenCalled();
  });

  it("processes greenhouse sources successfully", async () => {
    const result = await processSource({} as never, sourceGreenhouse);

    expect(mocked.mockFetchGreenhouseJobs).toHaveBeenCalledWith(sourceGreenhouse);
    expect(mocked.mockUpsertNormalizedJobs).toHaveBeenCalled();
    expect(mocked.mockFinishFetchRun).toHaveBeenCalledWith({} as never, 99, "success", summary, null);
    expect(mocked.mockUpdateSourceAfterRun).toHaveBeenCalledWith({} as never, sourceGreenhouse, true, null);
    expect(result.status).toBe("success");
  });

  it("processes lever sources successfully", async () => {
    const result = await processSource({} as never, sourceLever);

    expect(mocked.mockFetchLeverJobs).toHaveBeenCalledWith(sourceLever);
    expect(result.status).toBe("success");
  });

  it("processes ashby sources successfully", async () => {
    const result = await processSource({} as never, sourceAshby);

    expect(mocked.mockFetchAshbyJobs).toHaveBeenCalledWith(sourceAshby);
    expect(result.status).toBe("success");
  });

  it("marks run failed when provider throws", async () => {
    mocked.mockFetchGreenhouseJobs.mockRejectedValueOnce(new Error("rate limited"));

    const result = await processSource({} as never, sourceGreenhouse);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("rate limited");
    expect(mocked.mockFinishFetchRun).toHaveBeenCalledWith(
      {} as never,
      99,
      "failed",
      {
        jobsFound: 0,
        jobsInserted: 0,
        jobsUpdated: 0,
        jobsSkipped: 0,
      },
      "rate limited",
    );
    expect(mocked.mockUpdateSourceAfterRun).toHaveBeenCalledWith(
      {} as never,
      sourceGreenhouse,
      false,
      "rate limited",
    );
  });

  it("marks run failed when upsert throws", async () => {
    mocked.mockUpsertNormalizedJobs.mockRejectedValueOnce(new Error("insert failed"));

    const result = await processSource({} as never, sourceGreenhouse);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("insert failed");
    expect(mocked.mockFinishFetchRun).toHaveBeenCalled();
  });

  it("swallows cleanup failures and still returns failed", async () => {
    mocked.mockFetchGreenhouseJobs.mockRejectedValueOnce(new Error("provider down"));
    mocked.mockFinishFetchRun.mockRejectedValueOnce(new Error("finish failed"));
    mocked.mockUpdateSourceAfterRun.mockRejectedValueOnce(new Error("source update failed"));

    const result = await processSource({} as never, sourceGreenhouse);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("provider down");
  });
});

describe("fetchAllEnabledJobSources", () => {
  it("returns empty summary when there are no enabled sources", async () => {
    mocked.mockLoadEnabledJobSources.mockResolvedValueOnce([]);

    const result = await fetchAllEnabledJobSources();

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0, results: [] });
    expect(mocked.mockCreateServiceClient).toHaveBeenCalledTimes(1);
  });

  it("processes all sources and returns counts", async () => {
    mocked.mockLoadEnabledJobSources.mockResolvedValueOnce([sourceGreenhouse, sourceLever]);

    const result = await fetchAllEnabledJobSources();

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("continues processing when one source fails", async () => {
    mocked.mockLoadEnabledJobSources.mockResolvedValueOnce([sourceGreenhouse, sourceLever]);
    mocked.mockFetchGreenhouseJobs.mockRejectedValueOnce(new Error("first failed"));

    const result = await fetchAllEnabledJobSources();

    expect(result.processed).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].status).toBe("failed");
    expect(result.results[1].status).toBe("success");
  });

  it("logs a summary line", async () => {
    mocked.mockLoadEnabledJobSources.mockResolvedValueOnce([sourceGreenhouse]);
    const logSpy = vi.spyOn(console, "log");

    await fetchAllEnabledJobSources();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Done."));
  });
});

describe("fetchJobsForSourceId", () => {
  it("throws when source is missing", async () => {
    mocked.mockLoadJobSourceById.mockResolvedValueOnce(null);

    await expect(fetchJobsForSourceId(123)).rejects.toThrow(/was not found/);
  });

  it("processes one source and returns the source result", async () => {
    mocked.mockLoadJobSourceById.mockResolvedValueOnce(sourceGreenhouse);

    const result = await fetchJobsForSourceId(1);

    expect(mocked.mockCreateServiceClient).toHaveBeenCalledTimes(1);
    expect(mocked.mockLoadJobSourceById).toHaveBeenCalledWith({}, 1);
    expect(result.sourceId).toBe(1);
  });

  it("returns failed result when processing fails", async () => {
    mocked.mockLoadJobSourceById.mockResolvedValueOnce(sourceGreenhouse);
    mocked.mockCreateFetchRun.mockRejectedValueOnce(new Error("cannot create run"));

    const result = await fetchJobsForSourceId(1);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("cannot create run");
  });
});