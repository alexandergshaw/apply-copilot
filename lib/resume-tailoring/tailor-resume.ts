import sanitizeFilename from "sanitize-filename";

import { extractTextFromDocx } from "./docx-reader";
import { createTailoredResumeDocx } from "./docx-writer";
import type {
  ResumeTailoringInput,
  ResumeTailoringResult,
} from "./types";

type GetUsableResumeTextInput = {
  sourceDocxText: string | null;
  extractedText: string | null;
  templateText: string | null;
};

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getUsableResumeText({
  sourceDocxText,
  extractedText,
  templateText,
}: GetUsableResumeTextInput): string | null {
  return normalizeText(sourceDocxText) ?? normalizeText(extractedText) ?? normalizeText(templateText);
}

async function tailorResumeWithLlm(): Promise<ResumeTailoringResult> {
  throw new Error("LLM resume tailoring is not implemented yet.");
}

function buildOutputFilename(company: string | null, title: string): string {
  const baseName = `${company ?? "unknown-company"}-${title}-tailored-resume`
    .toLowerCase()
    .replace(/\s+/g, "-");
  const safeName = sanitizeFilename(baseName);
  return `${safeName || "tailored-resume"}.docx`;
}

export async function tailorResume(input: ResumeTailoringInput): Promise<ResumeTailoringResult> {
  if (!input.job) {
    throw new Error("Job is required for resume tailoring.");
  }
  if (!input.resumeTemplate) {
    throw new Error("Resume template is required for resume tailoring.");
  }
  if (!input.sourceDocxBuffer || input.sourceDocxBuffer.length === 0) {
    throw new Error("Source DOCX buffer is required for resume tailoring.");
  }

  const sourceDocxText = await extractTextFromDocx(input.sourceDocxBuffer);
  const usableText = getUsableResumeText({
    sourceDocxText,
    extractedText: input.resumeTemplate.extracted_text,
    templateText: input.resumeTemplate.template_text,
  });

  if (!usableText) {
    throw new Error("No usable resume text was found in the source DOCX or stored template fields.");
  }

  if (input.mode === "llm") {
    return tailorResumeWithLlm();
  }

  const companyName = input.job.company || "Unknown Company";
  const tailoredText = [
    `Tailored for ${input.job.title} at ${companyName}`,
    "",
    "Role Focus:",
    `- Title: ${input.job.title}`,
    `- Company: ${companyName}`,
    `- Location: ${input.job.location || "Not specified"}`,
    "",
    usableText,
  ].join("\n");

  const outputDocxBuffer = await createTailoredResumeDocx({
    sourceDocxBuffer: input.sourceDocxBuffer,
    tailoredText,
  });

  return {
    tailoredText,
    outputDocxBuffer,
    outputFilename: buildOutputFilename(input.job.company, input.job.title),
    sourceDocxStoragePath: input.resumeTemplate.docx_storage_path,
    tailoringNotes:
      "Draft DOCX generated automatically from the selected resume template. Review before using.",
    keywordCoverage: {
      status: "stub",
      message: "Keyword coverage will be generated later.",
      jobTitle: input.job.title,
      company: input.job.company,
    },
    matchScore: input.job.match_score ?? null,
    status: "draft",
  };
}