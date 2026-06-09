import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getDefaultResumeTemplateForProfileMock,
  getResumeTemplatesMock,
  getUserProfileMock,
  downloadResumeTemplateDocxMock,
  tailorResumeMock,
  uploadTailoredResumeDocxMock,
  getSupabaseServerClientMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getDefaultResumeTemplateForProfileMock: vi.fn(),
  getResumeTemplatesMock: vi.fn(),
  getUserProfileMock: vi.fn(),
  downloadResumeTemplateDocxMock: vi.fn(),
  tailorResumeMock: vi.fn(),
  uploadTailoredResumeDocxMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  getDefaultResumeTemplateForProfile: getDefaultResumeTemplateForProfileMock,
  getResumeTemplates: getResumeTemplatesMock,
  getUserProfile: getUserProfileMock,
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

import {
  autoApplyNow,
  automaticallyTailorResume,
  generateTailoredResume,
  tailorResumeForDownload,
} from "./actions";

function createSupabaseMock() {
  const insertMock = vi.fn().mockResolvedValue({ data: [{ id: 101 }], error: null });
  const updateDraftMock = vi.fn().mockResolvedValue({ data: [{ id: 100 }], error: null });

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
        update: (payload: unknown) => ({
          eq: () => ({
            select: () => ({
              limit: () => updateDraftMock(payload),
            }),
          }),
          in: () => Promise.resolve({ error: null }),
        }),
        insert: (payload: unknown) => ({
          select: () => ({
            limit: () => insertMock(payload),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from: fromMock }, insertMock };
}

describe("generateTailoredResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESUME_TAILORING_MODE;
    delete process.env.GEMINI_API_KEY;
    getUserProfileMock.mockResolvedValue({ id: "profile-123" });
    getDefaultResumeTemplateForProfileMock.mockResolvedValue({ id: 7 });
    getResumeTemplatesMock.mockResolvedValue([{ id: 7 }]);
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

  it("returns friendly error when llm mode is enabled without Gemini key", async () => {
    const supabaseMock = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);
    process.env.RESUME_TAILORING_MODE = "llm";
    delete process.env.GEMINI_API_KEY;

    const result = await generateTailoredResume("12", 7);

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "AI resume tailoring requires Gemini, but it is not configured. Set GEMINI_API_KEY (and optional GEMINI_MODEL) to generate a tailored resume.",
    );
  });
});

describe("automaticallyTailorResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESUME_TAILORING_MODE;
    delete process.env.GEMINI_API_KEY;
    getUserProfileMock.mockResolvedValue({ id: "profile-123" });
    getDefaultResumeTemplateForProfileMock.mockResolvedValue({ id: 7 });
    getResumeTemplatesMock.mockResolvedValue([{ id: 7 }]);
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

describe("tailorResumeForDownload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESUME_TAILORING_MODE;
    process.env.GEMINI_API_KEY = "test-gemini-key";
    getUserProfileMock.mockResolvedValue({ id: "profile-123" });
    getDefaultResumeTemplateForProfileMock.mockResolvedValue({ id: 7 });
    getResumeTemplatesMock.mockResolvedValue([{ id: 7 }]);
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

  it("returns tailored resume id and filename for download", async () => {
    const supabaseMock = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);

    const result = await tailorResumeForDownload("12");

    expect(result.ok).toBe(true);
    expect(result.tailoredResumeId).toBe(101);
    expect(result.jobId).toBe(12);
    expect(result.outputFilename).toBe("cloudline-staff-pm-tailored-resume.docx");
  });

  it("returns friendly error when no template exists", async () => {
    const supabaseMock = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);
    getDefaultResumeTemplateForProfileMock.mockResolvedValue(null);
    getResumeTemplatesMock.mockResolvedValue([]);

    const result = await tailorResumeForDownload("12");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("No resume template found. Upload one first.");
  });

  it("returns friendly error when Gemini is not configured", async () => {
    const supabaseMock = createSupabaseMock();
    getSupabaseServerClientMock.mockReturnValue(supabaseMock.client);
    delete process.env.GEMINI_API_KEY;

    const result = await tailorResumeForDownload("12");

    expect(result.ok).toBe(false);
    expect(result.message).toBe(
      "AI resume tailoring requires Gemini, but it is not configured. Set GEMINI_API_KEY (and optional GEMINI_MODEL) to generate a tailored resume.",
    );
  });
});

describe("autoApplyNow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
    getUserProfileMock.mockResolvedValue({
      id: "profile-123",
      name: "Ada",
      email: "ada@example.com",
      phone: "555-1111",
      location: "Austin, TX",
      linkedinUrl: "https://linkedin.com/in/ada",
      portfolioUrl: "https://ada.dev",
      githubUrl: "https://github.com/ada",
      summary: "shipping customer-facing product experiences",
      skills: ["Product Strategy", "Roadmapping"],
    });
    getDefaultResumeTemplateForProfileMock.mockResolvedValue({ id: 7 });
    getResumeTemplatesMock.mockResolvedValue([{ id: 7 }]);
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

  function createAutoApplyFromMock(options: {
    tailoredStatus: "approved" | "draft" | "reviewed" | "rejected" | "stale";
    profileFieldMissing?: boolean;
  }) {
    const applicationsInsertMock = vi.fn().mockResolvedValue({ error: null });

    const fromMock = vi.fn((table: string) => {
      if (table === "auto_apply_runs") {
        return {
          insert: () => ({
            select: () => ({
              limit: () => Promise.resolve({ data: [{ id: 201 }], error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }

      if (table === "jobs") {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
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

      if (table === "tailored_resumes") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: 301,
                          status: options.tailoredStatus,
                          tailored_text: "Tailored text",
                          tailoring_notes: "Generated notes",
                        },
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "application_packets") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              limit: () => Promise.resolve({ data: [{ id: 501 }], error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                limit: () => Promise.resolve({ data: [{ id: 501 }], error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "applications") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert: applicationsInsertMock,
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    if (options.profileFieldMissing) {
      getUserProfileMock.mockResolvedValue({
        id: "profile-123",
        name: "Ada",
        email: "",
        phone: "",
        location: "Austin, TX",
        linkedinUrl: "",
        portfolioUrl: "https://ada.dev",
        githubUrl: "https://github.com/ada",
        summary: "shipping customer-facing product experiences",
        skills: ["Product Strategy", "Roadmapping"],
      });
    }

    return {
      fromMock,
      applicationsInsertMock,
    };
  }

  it("completes auto-apply only when tailored resume is already approved", async () => {
    const { fromMock, applicationsInsertMock } = createAutoApplyFromMock({
      tailoredStatus: "approved",
    });
    getSupabaseServerClientMock.mockReturnValue({ from: fromMock });

    const result = await autoApplyNow("12");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Auto-apply completed");
    expect(applicationsInsertMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/applications");
    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs/12");
  });

  it("blocks auto-apply when profile is missing", async () => {
    getUserProfileMock.mockResolvedValue(null);

    const fromMock = vi.fn((table: string) => {
      if (table === "auto_apply_runs") {
        return {
          insert: () => ({
            select: () => ({
              limit: () => Promise.resolve({ data: [{ id: 201 }], error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }

      if (table === "jobs") {
        return {
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    getSupabaseServerClientMock.mockReturnValue({ from: fromMock });

    const result = await autoApplyNow("12");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("No profile found");
  });

  it("marks auto-apply as needs_review when required profile fields are missing", async () => {
    const { fromMock, applicationsInsertMock } = createAutoApplyFromMock({
      tailoredStatus: "approved",
      profileFieldMissing: true,
    });
    getSupabaseServerClientMock.mockReturnValue({ from: fromMock });

    const result = await autoApplyNow("12");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("paused for review");
    expect(applicationsInsertMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs");
    expect(revalidatePathMock).toHaveBeenCalledWith("/jobs/12");
  });

  it("pauses auto-apply when tailored resume is not approved", async () => {
    const { fromMock, applicationsInsertMock } = createAutoApplyFromMock({
      tailoredStatus: "draft",
    });
    getSupabaseServerClientMock.mockReturnValue({ from: fromMock });

    const result = await autoApplyNow("12");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Approve the tailored resume");
    expect(applicationsInsertMock).not.toHaveBeenCalled();
  });
});
