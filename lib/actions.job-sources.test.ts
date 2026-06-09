import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServerClientMock, revalidatePathMock } = vi.hoisted(() => ({
  getSupabaseServerClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  applyDefaultFiltersToAllJobSources,
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
  });

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
});
