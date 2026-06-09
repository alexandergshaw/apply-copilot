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

import { deleteJob } from "./actions";

type DeleteResult = {
  error: { message: string; code?: string } | null;
};

function createSupabaseMock(deleteResult: DeleteResult = { error: null }) {
  const eqMock = vi.fn().mockResolvedValue(deleteResult);
  const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

  const fromMock = vi.fn((table: string) => {
    if (table !== "jobs") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      delete: deleteMock,
    };
  });

  return {
    client: { from: fromMock },
    fromMock,
    deleteMock,
    eqMock,
  };
}

describe("deleteJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a job and revalidates job-related pages", async () => {
    const supabase = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await deleteJob("12");

    expect(result).toEqual({ ok: true });
    expect(supabase.fromMock).toHaveBeenCalledWith("jobs");
    expect(supabase.deleteMock).toHaveBeenCalledTimes(1);
    expect(supabase.eqMock).toHaveBeenCalledWith("id", 12);
    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs/12");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePathMock).toHaveBeenCalledWith("/applications");
  });

  it("returns invalid id error for non-numeric job ids", async () => {
    const supabase = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await deleteJob("job-101");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid job id.");
    expect(supabase.fromMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns not configured error when Supabase is missing", async () => {
    getSupabaseServerClientMock.mockReturnValue(null);

    const result = await deleteJob("12");

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "Supabase is not configured. Add environment variables to persist changes.",
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("maps RLS errors to friendly message", async () => {
    const supabase = createSupabaseMock({
      error: { message: "new row violates row-level security policy", code: "42501" },
    });
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await deleteJob("12");

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "Action blocked by Supabase RLS. Apply the latest migration that adds application_packets policies, then retry.",
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns raw error message for non-RLS failures", async () => {
    const supabase = createSupabaseMock({
      error: { message: "delete failed" },
    });
    getSupabaseServerClientMock.mockReturnValue(supabase.client);

    const result = await deleteJob("12");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("delete failed");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
