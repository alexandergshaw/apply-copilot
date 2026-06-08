import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSupabaseServerClientMock,
  getMissingSupabaseEnvVarsMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  getSupabaseServerClientMock: vi.fn(),
  getMissingSupabaseEnvVarsMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

vi.mock("@/lib/supabase/config", () => ({
  getMissingSupabaseEnvVars: getMissingSupabaseEnvVarsMock,
}));

vi.mock("@/lib/job-import/extract", () => ({
  extractJobPostingFromHtml: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { createManualJob } from "./actions";

type SupabaseError = {
  message: string;
  code?: string;
};

function createFormData(overrideExistingUrl = false): FormData {
  const formData = new FormData();
  formData.set("title", "Software Engineer");
  formData.set("company", "Anaplan");
  formData.set("location", "Gurugram, India");
  formData.set("apply_url", "https://job-boards.greenhouse.io/anaplan/jobs/8571211002");
  formData.set("description", "Build resilient backend systems");
  formData.set("status", "found");
  if (overrideExistingUrl) {
    formData.set("override_existing_url", "on");
  }

  return formData;
}

function createSupabaseMock(options: { insertError: SupabaseError | null; updateError?: SupabaseError | null }) {
  const eqMock = vi.fn().mockResolvedValue({ error: options.updateError ?? null });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  const insertMock = vi.fn().mockResolvedValue({ error: options.insertError });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock, update: updateMock });

  return {
    client: { from: fromMock },
    fromMock,
    insertMock,
    updateMock,
    eqMock,
  };
}

describe("createManualJob duplicate URL override flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMissingSupabaseEnvVarsMock.mockReturnValue([]);
  });

  it("returns canOverride=true when apply_url already exists and override is not enabled", async () => {
    const duplicateError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "jobs_apply_url_key" (apply_url)',
    };
    const supabaseMock = createSupabaseMock({ insertError: duplicateError });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await createManualJob(createFormData(false));

    expect(result.ok).toBe(false);
    expect(result.canOverride).toBe(true);
    expect(result.message).toContain("Enable override");
    expect(supabaseMock.updateMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("updates existing job and redirects when override is enabled", async () => {
    const duplicateError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "jobs_apply_url_key" (apply_url)',
    };
    const supabaseMock = createSupabaseMock({ insertError: duplicateError, updateError: null });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    await createManualJob(createFormData(true));

    expect(supabaseMock.updateMock).toHaveBeenCalledTimes(1);
    expect(supabaseMock.eqMock).toHaveBeenCalledWith(
      "apply_url",
      "https://job-boards.greenhouse.io/anaplan/jobs/8571211002",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs");
    expect(redirectMock).toHaveBeenCalledWith("/jobs");
  });

  it("returns a friendly error when override update fails", async () => {
    const duplicateError = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "jobs_apply_url_key" (apply_url)',
    };
    const updateFailure = {
      code: "42501",
      message: "new row violates row-level security policy",
    };
    const supabaseMock = createSupabaseMock({
      insertError: duplicateError,
      updateError: updateFailure,
    });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await createManualJob(createFormData(true));

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Supabase RLS blocked writes to jobs");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
