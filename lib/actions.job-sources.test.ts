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

import { createJobSource, updateJobSource } from "./actions";

function createSupabaseMock() {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
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
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(supabase.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch_interval_minutes: 15,
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
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(supabase.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch_interval_minutes: null,
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
      enabled: true,
    });

    expect(result.ok).toBe(true);
    expect(supabase.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        fetch_interval_minutes: null,
      }),
    );
  });
});
