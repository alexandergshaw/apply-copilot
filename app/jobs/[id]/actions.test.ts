import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  downloadResumeTemplateDocxMock,
  tailorResumeMock,
  uploadTailoredResumeDocxMock,
  getSupabaseServerClientMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  downloadResumeTemplateDocxMock: vi.fn(),
  tailorResumeMock: vi.fn(),
  uploadTailoredResumeDocxMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/resume-tailoring", () => ({
  downloadResumeTemplateDocx: downloadResumeTemplateDocxMock,
  tailorResume: tailorResumeMock,
  uploadTailoredResumeDocx: uploadTailoredResumeDocxMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { automaticallyTailorResume, generateTailoredResume } from "./actions";

function createSupabaseMock() {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const updateDraftMock = vi.fn().mockResolvedValue({ error: null });

  const fromMock = vi.fn((table: string) => {
    if (table === "jobs") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: 12,
                  title: "Staff PM",
                  company: "CloudLine",
                  location: "Remote",
                  salary: null,
                  description: "Build products",
                  match_score: 88,
                },
                error: null,
              }),
          }),
        }),
      };
    }

    if (table === "resume_templates") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: 7,
                  profile_id: "profile-123",
                  name: "Template",
                  target_role: "PM",
                  original_filename: "resume.docx",
                  docx_storage_path: "profile-123/7/resume.docx",
                  extracted_text: "Extracted",
                  template_text: "Template",
                  template_json: {},
                },
                error: null,
              }),
          }),
        }),
      };
    }

    if (table === "user_profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: "profile-123" }, error: null }),
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
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
        update: () => ({
          eq: (...args: unknown[]) => updateDraftMock(...args),
          in: () => Promise.resolve({ error: null }),
        }),
        insert: insertMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from: fromMock }, insertMock };
}

describe("generateTailoredResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloadResumeTemplateDocxMock.mockResolvedValue(Buffer.from("docx"));
    tailorResumeMock.mockResolvedValue({
      tailoredText: "Tailored text",
      outputDocxBuffer: Buffer.from("generated-docx"),
      outputFilename: "cloudline-staff-pm-tailored-resume.docx",
      sourceDocxStoragePath: "profile-123/7/resume.docx",
      tailoringNotes: "Draft DOCX generated automatically from the selected resume template. Review before using.",
      keywordCoverage: { status: "stub" },
      matchScore: 88,
      status: "draft",
    });
    uploadTailoredResumeDocxMock.mockResolvedValue({
      path: "profile-123/12/tailored-resume-7-123.docx",
    });
  });

  it("returns an error for invalid job id", async () => {
    const result = await generateTailoredResume("invalid", 7);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid job id.");
  });

  it("creates a tailored DOCX draft and stores metadata", async () => {
    const supabaseMock = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await generateTailoredResume("12", 7);

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Tailored DOCX draft generated. Review before using.");
    expect(downloadResumeTemplateDocxMock).toHaveBeenCalledWith(
      supabaseMock.client,
      "profile-123/7/resume.docx",
    );
    expect(uploadTailoredResumeDocxMock).toHaveBeenCalled();

    const payload = supabaseMock.insertMock.mock.calls[0][0];
    expect(payload.status).toBe("draft");
    expect(payload.tailored_text).toBe("Tailored text");
    expect(payload.output_filename).toBe("cloudline-staff-pm-tailored-resume.docx");
    expect(payload.output_docx_storage_path).toBe("profile-123/12/tailored-resume-7-123.docx");
    expect(payload.source_docx_storage_path).toBe("profile-123/7/resume.docx");
  });
});

describe("automaticallyTailorResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloadResumeTemplateDocxMock.mockResolvedValue(Buffer.from("docx"));
    tailorResumeMock.mockResolvedValue({
      tailoredText: "Tailored text",
      outputDocxBuffer: Buffer.from("generated-docx"),
      outputFilename: "cloudline-staff-pm-tailored-resume.docx",
      sourceDocxStoragePath: "profile-123/7/resume.docx",
      tailoringNotes: "Draft DOCX generated automatically from the selected resume template. Review before using.",
      keywordCoverage: { status: "stub" },
      matchScore: 88,
      status: "draft",
    });
    uploadTailoredResumeDocxMock.mockResolvedValue({
      path: "profile-123/12/tailored-resume-7-123.docx",
    });
  });

  it("delegates to DOCX draft generation flow", async () => {
    const supabaseMock = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await automaticallyTailorResume("12", 7);

    expect(result.ok).toBe(true);
    expect(tailorResumeMock).toHaveBeenCalledTimes(1);
  });
});
