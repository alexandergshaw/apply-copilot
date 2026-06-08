import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock, GoogleGenAIMock } = vi.hoisted(() => {
  const generateContent = vi.fn();
  const GoogleGenAI = vi.fn(function GoogleGenAI() {
    return {
      models: {
        generateContent,
      },
    };
  });

  return {
    generateContentMock: generateContent,
    GoogleGenAIMock: GoogleGenAI,
  };
});

vi.mock("@google/genai", () => ({
  GoogleGenAI: GoogleGenAIMock,
}));

import { GeminiResumeTailoringService } from "./gemini-service";

describe("GeminiResumeTailoringService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("returns parsed structured output from Gemini JSON text", async () => {
    const service = new GeminiResumeTailoringService();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        tailoredText: "Tailored resume body",
        tailoringNotes: "Focused on PM keywords.",
        keywordCoverage: { matched: ["roadmap", "stakeholder"] },
      }),
    });

    const result = await service.tailorResume({
      job: {
        id: 1,
        title: "Product Manager",
        company: "Acme",
        location: "Remote",
        salary: null,
        description: "Own product lifecycle",
        match_score: 90,
      },
      resumeText: "Source resume text",
      profile: { seniority: "senior" },
    });

    expect(result).toEqual({
      tailoredText: "Tailored resume body",
      tailoringNotes: "Focused on PM keywords.",
      keywordCoverage: { matched: ["roadmap", "stakeholder"] },
    });
    expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("throws readable error when API key is missing", async () => {
    const service = new GeminiResumeTailoringService();
    delete process.env.GEMINI_API_KEY;

    await expect(
      service.tailorResume({
        job: {
          id: 1,
          title: "Product Manager",
          company: "Acme",
          location: null,
          salary: null,
          description: null,
          match_score: null,
        },
        resumeText: "Source resume text",
      }),
    ).rejects.toThrow("GEMINI_API_KEY is not configured.");
  });

  it("throws readable parse error when output is not JSON", async () => {
    const service = new GeminiResumeTailoringService();
    generateContentMock.mockResolvedValue({ text: "not-json" });

    await expect(
      service.tailorResume({
        job: {
          id: 1,
          title: "Product Manager",
          company: "Acme",
          location: null,
          salary: null,
          description: null,
          match_score: null,
        },
        resumeText: "Source resume text",
      }),
    ).rejects.toThrow("Gemini response could not be parsed as JSON.");
  });
});
