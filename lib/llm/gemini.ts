import { GoogleGenAI } from "@google/genai";

import type {
  ResumeTailoringJob,
  ResumeTailoringLlmOutput,
} from "@/lib/resume-tailoring/types";

type TailorResumeWithGeminiInput = {
  job: ResumeTailoringJob;
  resumeText: string;
  profile?: unknown;
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function buildGeminiPrompt(input: TailorResumeWithGeminiInput): string {
  return [
    "You are an assistant tailoring a resume for a specific job.",
    "Use only provided information. Do not invent credentials, employers, dates, metrics, or experience.",
    "Return STRICT JSON only with this shape:",
    '{"tailoredText":"string","tailoringNotes":"string","keywordCoverage":{}}',
    "",
    "JOB:",
    `- Title: ${input.job.title}`,
    `- Company: ${input.job.company ?? "Unknown Company"}`,
    `- Location: ${input.job.location ?? "Not specified"}`,
    `- Salary: ${input.job.salary ?? "Not specified"}`,
    `- Description: ${input.job.description ?? "Not provided"}`,
    "",
    "RESUME SOURCE TEXT:",
    input.resumeText,
    "",
    "OPTIONAL PROFILE CONTEXT (JSON):",
    JSON.stringify(input.profile ?? null),
    "",
    "Output constraints:",
    "- tailoredText should be resume-ready plain text.",
    "- tailoringNotes should be concise and factual.",
    "- keywordCoverage should be an object summarizing alignment and missing keywords.",
  ].join("\n");
}

function extractJsonPayload(rawText: string): string {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/```\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  return trimmed;
}

function assertLlmOutputShape(value: unknown): asserts value is ResumeTailoringLlmOutput {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini response JSON must be an object.");
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.tailoredText !== "string" || !candidate.tailoredText.trim()) {
    throw new Error("Gemini response is missing a non-empty tailoredText string.");
  }

  if (typeof candidate.tailoringNotes !== "string") {
    throw new Error("Gemini response is missing a tailoringNotes string.");
  }

  if (
    !candidate.keywordCoverage
    || typeof candidate.keywordCoverage !== "object"
    || Array.isArray(candidate.keywordCoverage)
  ) {
    throw new Error("Gemini response is missing a keywordCoverage object.");
  }
}

export async function tailorResumeWithGemini(
  input: TailorResumeWithGeminiInput,
): Promise<ResumeTailoringLlmOutput> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const ai = new GoogleGenAI({ apiKey });

  let rawText: string;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: buildGeminiPrompt(input),
    });
    rawText = response.text?.trim() ?? "";
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown Gemini error";
    throw new Error(`Gemini resume tailoring request failed: ${detail}`);
  }

  if (!rawText) {
    throw new Error("Gemini returned an empty response.");
  }

  const jsonPayload = extractJsonPayload(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload);
  } catch {
    throw new Error("Gemini response could not be parsed as JSON.");
  }

  assertLlmOutputShape(parsed);

  return {
    tailoredText: parsed.tailoredText.trim(),
    tailoringNotes: parsed.tailoringNotes,
    keywordCoverage: parsed.keywordCoverage,
  };
}
