import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tailorResumeWithGeminiMock } = vi.hoisted(() => ({
  tailorResumeWithGeminiMock: vi.fn(),
}));

vi.mock("@/lib/llm/gemini", () => ({
  tailorResumeWithGemini: tailorResumeWithGeminiMock,
}));

import { createTailoredResumeDocx } from "./docx-writer";
import { extractTextFromDocx } from "./docx-reader";
import { getUsableResumeText, tailorResume } from "./tailor-resume";
import type { ResumeTailoringInput } from "./types";

async function createDocxBuffer(paragraphs: string[]): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.map((text, index) =>
          new Paragraph(
            index === 0
              ? {
                  text,
                  heading: HeadingLevel.HEADING_1,
                }
              : text,
          ),
        ),
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function createInput(overrides?: Partial<ResumeTailoringInput>): ResumeTailoringInput {
  return {
    job: {
      id: 10,
      title: "Senior Product Manager",
      company: "Acme/Cloud",
      location: "Remote",
      salary: null,
      description: "Own roadmap",
      match_score: 92,
    },
    resumeTemplate: {
      id: 7,
      profile_id: "profile-123",
      name: "PM Template",
      target_role: "Product Manager",
      original_filename: "resume.docx",
      docx_storage_path: "profile-123/7/resume.docx",
      extracted_text: "Stored extracted text",
      template_text: "Stored template text",
      template_json: null,
    },
    sourceDocxBuffer: Buffer.from(""),
    mode: "stub",
    ...overrides,
  };
}

describe("docx-reader", () => {
  it("extracts text from a DOCX buffer", async () => {
    const buffer = await createDocxBuffer(["First paragraph", "Second paragraph"]);

    const text = await extractTextFromDocx(buffer);

    expect(text).toContain("First paragraph");
    expect(text).toContain("Second paragraph");
  });
});

describe("getUsableResumeText", () => {
  it("prefers source DOCX text", () => {
    const result = getUsableResumeText({
      sourceDocxText: "Source text",
      extractedText: "Extracted text",
      templateText: "Template text",
    });

    expect(result).toBe("Source text");
  });

  it("falls back to extracted_text", () => {
    const result = getUsableResumeText({
      sourceDocxText: "",
      extractedText: "Extracted text",
      templateText: "Template text",
    });

    expect(result).toBe("Extracted text");
  });

  it("falls back to template_text", () => {
    const result = getUsableResumeText({
      sourceDocxText: null,
      extractedText: "   ",
      templateText: "Template text",
    });

    expect(result).toBe("Template text");
  });
});

describe("tailorResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tailorResumeWithGeminiMock.mockResolvedValue({
      tailoredText: "LLM tailored resume text",
      tailoringNotes: "LLM draft notes",
      keywordCoverage: { source: "gemini" },
    });
  });

  it("throws when no usable text exists", async () => {
    const emptyDocx = await createDocxBuffer([]);
    const input = createInput({
      sourceDocxBuffer: emptyDocx,
      resumeTemplate: {
        id: 7,
        profile_id: "profile-123",
        name: "PM Template",
        target_role: null,
        original_filename: null,
        docx_storage_path: "profile-123/7/resume.docx",
        extracted_text: "",
        template_text: "",
        template_json: null,
      },
    });

    await expect(tailorResume(input)).rejects.toThrow(
      "No usable resume text was found in the source DOCX or stored template fields.",
    );
  });

  it("returns draft output with safe filename and DOCX buffer", async () => {
    const sourceDocx = await createDocxBuffer(["Candidate summary", "Experience block"]);
    const input = createInput({ sourceDocxBuffer: sourceDocx });

    const result = await tailorResume(input);

    expect(result.status).toBe("draft");
    expect(Buffer.isBuffer(result.outputDocxBuffer)).toBe(true);
    expect(result.outputDocxBuffer.length).toBeGreaterThan(0);
    expect(result.outputFilename).toBe("acmecloud-senior-product-manager-tailored-resume.docx");
    expect(result.keywordCoverage).toEqual({
      status: "stub",
      message: "Keyword coverage will be generated later.",
      jobTitle: "Senior Product Manager",
      company: "Acme/Cloud",
    });
  });

  it("uses Gemini adapter in llm mode", async () => {
    const sourceDocx = await createDocxBuffer(["Candidate summary", "Experience block"]);
    const input = createInput({ sourceDocxBuffer: sourceDocx, mode: "llm" });

    const result = await tailorResume(input);

    expect(tailorResumeWithGeminiMock).toHaveBeenCalledTimes(1);
    expect(result.tailoredText).toBe("LLM tailored resume text");
    expect(result.tailoringNotes).toBe("LLM draft notes");
    expect(result.keywordCoverage).toEqual({ source: "gemini" });
    expect(result.status).toBe("draft");
  });

  it("keeps stub mode unaffected", async () => {
    const sourceDocx = await createDocxBuffer(["Candidate summary", "Experience block"]);
    const input = createInput({ sourceDocxBuffer: sourceDocx, mode: "stub" });

    const result = await tailorResume(input);

    expect(tailorResumeWithGeminiMock).not.toHaveBeenCalled();
    expect(result.keywordCoverage).toEqual({
      status: "stub",
      message: "Keyword coverage will be generated later.",
      jobTitle: "Senior Product Manager",
      company: "Acme/Cloud",
    });
  });
});

describe("createTailoredResumeDocx", () => {
  it("preserves original styles.xml while inserting tailored content", async () => {
    const sourceDocx = await createDocxBuffer(["Original Heading", "Original summary"]);
    const sourceZip = await JSZip.loadAsync(sourceDocx);
    const sourceStyles = await sourceZip.file("word/styles.xml")?.async("string");

    const output = await createTailoredResumeDocx({
      sourceDocxBuffer: sourceDocx,
      tailoredText: "Tailored for Senior Product Manager at Acme/Cloud\n\nUpdated summary",
    });

    const outputZip = await JSZip.loadAsync(output);
    const outputStyles = await outputZip.file("word/styles.xml")?.async("string");
    const outputDocument = await outputZip.file("word/document.xml")?.async("string");

    expect(sourceStyles).toBeDefined();
    expect(outputStyles).toBe(sourceStyles);
    expect(outputDocument).toContain("Tailored for Senior Product Manager at Acme/Cloud");
    expect(outputDocument).toContain("Updated summary");
  });

  it("throws a readable error when source buffer is not a DOCX package", async () => {
    await expect(
      createTailoredResumeDocx({
        sourceDocxBuffer: Buffer.from("not-a-docx"),
        tailoredText: "Tailored text",
      }),
    ).rejects.toThrow("Failed to read source DOCX package:");
  });
});
