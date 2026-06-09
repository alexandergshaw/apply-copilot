import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClientMock, revalidatePathMock } = vi.hoisted(() => ({
  getSupabaseServerClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

const { fetchJobsForSourceIdMock } = vi.hoisted(() => ({
  fetchJobsForSourceIdMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/workers/job-fetcher/fetch-all", () => ({
  fetchJobsForSourceId: fetchJobsForSourceIdMock,
}));

import {
  applyDefaultFiltersToAllJobSources,
  createJobSourceAndFetch,
  createJobSource,
  updateJobSource,
} from "./actions";

function createSupabaseMock() {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
    gt: vi.fn().mockResolvedValue({ error: null }),
  });

  const fromMock = vi.fn((table: string) => {
    if (table !== "job_sources") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      insert: insertMock,
      update: updateMock,
    };
  });

  return {
    client: { from: fromMock },
    insertMock,
    updateMock,
  };
}

describe("job source interval mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchJobsForSourceIdMock.mockResolvedValue({
      status: "success",
      summary: { jobsFound: 0, jobsInserted: 2, jobsUpdated: 1, jobsSkipped: 0 },
    });
  });

  function createSupabaseCreateAndFetchMock(id = 42, insertError: { message: string } | null = null) {
    const singleMock = vi.fn().mockResolvedValue(
      insertError
        ? { data: null, error: insertError }
        : { data: { id }, error: null },
    );
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });

    const fromMock = vi.fn((table: string) => {
      if (table !== "job_sources") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert: insertMock,
      };
    });

    return {
      client: { from: fromMock },
      insertMock,
      selectMock,
      singleMock,
    };
  }

  it("maps fetchIntervalMinutes to fetch_interval_minutes on create", async () => {
    const supabase = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await createJobSource({
      sourceName: "Acme",
      sourceType: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      companyName: "Acme",
      companySlug: "acme",
      fetchIntervalMinutes: "15",
      remoteOnly: true,
      postedWithinDays: "1",
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(supabase.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch_interval_minutes: 15,
        remote_only: true,
        posted_within_days: 1,
      }),
    );
  });

  it("stores null fetch_interval_minutes when interval is blank", async () => {
    const supabase = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await createJobSource({
      sourceName: "Acme",
      sourceType: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      companyName: "Acme",
      companySlug: "acme",
      fetchIntervalMinutes: "",
      remoteOnly: true,
      postedWithinDays: "",
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(supabase.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch_interval_minutes: null,
        posted_within_days: 1,
      }),
    );
  });

  it("stores null fetch_interval_minutes when interval is invalid on update", async () => {
    const supabase = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await updateJobSource("1", {
      sourceName: "Acme",
      sourceType: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      companyName: "Acme",
      companySlug: "acme",
      fetchIntervalMinutes: "0",
      remoteOnly: false,
      postedWithinDays: "0",
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(supabase.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch_interval_minutes: null,
        remote_only: false,
        posted_within_days: 1,
      }),
    );
  });

  it("applies default filters to all job sources", async () => {
    const supabase = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await applyDefaultFiltersToAllJobSources();

    expect(result.ok).toBe(true);
    expect(supabase.updateMock).toHaveBeenCalledWith({
      remote_only: true,
      posted_within_days: 1,
    });
    expect(supabase.updateMock.mock.results[0]?.value.gt).toHaveBeenCalledWith("id", 0);
  });

  it("creates a source then fetches jobs for that source", async () => {
    const supabase = createSupabaseCreateAndFetchMock(99);
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await createJobSourceAndFetch({
      sourceName: "Acme",
      sourceType: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      companyName: "Acme",
      companySlug: "acme",
      fetchIntervalMinutes: "15",
      remoteOnly: true,
      postedWithinDays: "1",
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(fetchJobsForSourceIdMock).toHaveBeenCalledWith(99);
    expect(result.message).toContain("Source created.");
    expect(result.message).toContain("Fetched");
  });

  it("does not fetch when source creation fails", async () => {
    const supabase = createSupabaseCreateAndFetchMock(42, { message: "insert failed" });
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await createJobSourceAndFetch({
      sourceName: "Acme",
      sourceType: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      companyName: "Acme",
      companySlug: "acme",
      fetchIntervalMinutes: "15",
      remoteOnly: true,
      postedWithinDays: "1",
      enabled: true,
    });

    expect(result.ok).toBe(false);
    expect(fetchJobsForSourceIdMock).not.toHaveBeenCalled();
  });

  it("returns non-blocking success when create succeeds but fetch fails", async () => {
    const supabase = createSupabaseCreateAndFetchMock(77);
    getSupabaseServerClientMock.mockReturnValue(supabase.client);
    fetchJobsForSourceIdMock.mockResolvedValueOnce({
      status: "failed",
      summary: { jobsFound: 0, jobsInserted: 0, jobsUpdated: 0, jobsSkipped: 0 },
      error: "provider unavailable",
    });

    const result = await createJobSourceAndFetch({
      sourceName: "Acme",
      sourceType: "greenhouse",
      url: "https://boards.greenhouse.io/acme",
      companyName: "Acme",
      companySlug: "acme",
      fetchIntervalMinutes: "15",
      remoteOnly: true,
      postedWithinDays: "1",
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Source created, but fetch failed");
  });
});
