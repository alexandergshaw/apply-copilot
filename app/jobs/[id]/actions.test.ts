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

import { automaticallyTailorResume, generateTailoredResume } from "./actions";

type JobRow = {
  id: number;
  source_id: number | null;
  title: string;
  company: string | null;
  match_score: number | null;
};

type TemplateRow = {
  id: number;
  extracted_text: string | null;
  template_text: string | null;
};

type DraftRow = { id: number };

function createSupabaseMock(options: {
  job: JobRow | null;
  template: TemplateRow | null;
  existingDrafts?: DraftRow[];
}) {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const updateDraftMock = vi.fn().mockResolvedValue({ error: null });
  const staleUpdateMock = vi.fn().mockResolvedValue({ error: null });

  const fromMock = vi.fn((table: string) => {
    if (table === "jobs") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: options.job, error: null }),
          }),
        }),
      };
    }

    if (table === "resume_templates") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: options.template, error: null }),
          }),
        }),
      };
    }

    if (table === "tailored_resumes") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({ data: options.existingDrafts ?? [], error: null }),
              }),
            }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: (...args: unknown[]) => updateDraftMock(payload, ...args),
          in: (...args: unknown[]) => staleUpdateMock(payload, ...args),
        }),
        insert: insertMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from: fromMock },
    fromMock,
    insertMock,
    updateDraftMock,
    staleUpdateMock,
  };
}

const baseTemplate: TemplateRow = {
  id: 7,
  extracted_text: "Experienced product leader.",
  template_text: null,
};

describe("generateTailoredResume draft generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tailors resumes for jobs imported from a source (no manual-import gate)", async () => {
    const supabaseMock = createSupabaseMock({
      job: { id: 12, source_id: 3, title: "Staff PM", company: "CloudLine", match_score: 88 },
      template: baseTemplate,
    });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await generateTailoredResume("12", 7);

    expect(result.ok).toBe(true);
    expect(supabaseMock.insertMock).toHaveBeenCalledTimes(1);
  });

  it("writes the expected tailored text, notes, and keyword coverage copy", async () => {
    const supabaseMock = createSupabaseMock({
      job: { id: 12, source_id: 3, title: "Staff PM", company: "CloudLine", match_score: 88 },
      template: baseTemplate,
    });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    await generateTailoredResume("12", 7);

    const payload = supabaseMock.insertMock.mock.calls[0][0];
    expect(payload.tailored_text).toBe(
      "Tailored for Staff PM at CloudLine.\n\nExperienced product leader.",
    );
    expect(payload.tailoring_notes).toBe(
      "Draft generated automatically from the selected resume template. Review before using.",
    );
    expect(payload.keyword_coverage).toEqual({
      status: "stub",
      message: "Keyword coverage will be generated later.",
    });
    expect(payload.match_score).toBe(88);
    expect(payload.status).toBe("draft");
  });

  it("falls back to a placeholder company name when company is null", async () => {
    const supabaseMock = createSupabaseMock({
      job: { id: 4, source_id: null, title: "Principal PM", company: null, match_score: null },
      template: baseTemplate,
    });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    await generateTailoredResume("4", 7);

    const payload = supabaseMock.insertMock.mock.calls[0][0];
    expect(payload.tailored_text).toBe(
      "Tailored for Principal PM at Unknown Company.\n\nExperienced product leader.",
    );
  });

  it("updates the active draft and marks older drafts stale", async () => {
    const supabaseMock = createSupabaseMock({
      job: { id: 12, source_id: 3, title: "Staff PM", company: "CloudLine", match_score: 88 },
      template: baseTemplate,
      existingDrafts: [{ id: 100 }, { id: 99 }, { id: 98 }],
    });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await generateTailoredResume("12", 7);

    expect(result.ok).toBe(true);
    expect(supabaseMock.insertMock).not.toHaveBeenCalled();
    expect(supabaseMock.updateDraftMock).toHaveBeenCalledTimes(1);
    expect(supabaseMock.updateDraftMock).toHaveBeenCalledWith(expect.any(Object), "id", 100);
    expect(supabaseMock.staleUpdateMock).toHaveBeenCalledWith(
      { status: "stale" },
      "id",
      [99, 98],
    );
  });

  it("returns an error for an invalid job id", async () => {
    const result = await generateTailoredResume("not-a-number", 7);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid job id.");
  });
});

describe("automaticallyTailorResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the same draft generation as generateTailoredResume", async () => {
    const supabaseMock = createSupabaseMock({
      job: { id: 5, source_id: 9, title: "Senior PM", company: "NorthStar", match_score: 91 },
      template: baseTemplate,
    });
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await automaticallyTailorResume("5", 7);

    expect(result.ok).toBe(true);
    const payload = supabaseMock.insertMock.mock.calls[0][0];
    expect(payload.tailored_text).toBe(
      "Tailored for Senior PM at NorthStar.\n\nExperienced product leader.",
    );
  });
});
