import { GoogleGenAI } from "@google/genai";

import type {
  LlmResumeTailoringInput,
  LlmResumeTailoringOutput,
  LlmResumeTailoringService,
} from "@/lib/llm/types";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const status = (error as { status?: unknown }).status;
  if (typeof status === "number" && RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }
  if (typeof status === "string" && /UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL/i.test(status)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /\b(429|500|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|try again later/i.test(
    message,
  );
}

function buildGeminiPrompt(input: LlmResumeTailoringInput): string {
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
    "RESUME SOURCE TEXT (each line is one paragraph in the original document):",
    input.resumeText,
    "",
    "OPTIONAL PROFILE CONTEXT (JSON):",
    JSON.stringify(input.profile ?? null),
    "",
    "STRICT FORMATTING RULES for tailoredText (these are mandatory):",
    "- Preserve the EXACT line structure of the source: output the SAME number of lines, in the SAME order.",
    "- Each output line must correspond 1:1 to the source line at the same position. Rewrite wording only.",
    "- Do NOT add, remove, merge, split, or reorder lines, sections, or bullets.",
    "- Keep section headers (e.g. EXPERIENCE, EDUCATION, SKILLS) exactly as they appear in the source.",
    "- Keep names, employers, job titles, dates, and locations unchanged.",
    "- Do NOT add markdown, asterisks, dashes, numbering, or decorative characters that are not already in the source line.",
    "- Preserve any leading bullet character or indentation marker that the source line already uses.",
    "- Keep each line a single line: never insert line breaks within a line.",
    "- Empty lines in the source must remain empty lines in the output at the same position.",
    "",
    "Output constraints:",
    "- tailoredText must be resume-ready plain text following the rules above.",
    "- tailoringNotes should be concise and factual.",
    "- keywordCoverage should be an object summarizing alignment and missing keywords.",
  ].join("\n");
}

function extractJsonPayload(rawText: string): string {
  const trimmed = rawText.trim();
  const fencedMatch =
    trimmed.match(/```json\s*([\s\S]*?)\s*```/i)
    ?? trimmed.match(/```\s*([\s\S]*?)\s*```/i);

  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  // Fallback: if the model wrapped JSON in prose, slice from the first
  // opening brace to the last closing brace.
  if (!candidate.startsWith("{")) {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return candidate.slice(firstBrace, lastBrace + 1).trim();
    }
  }

  return candidate;
}

function assertLlmOutputShape(value: unknown): asserts value is LlmResumeTailoringOutput {
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

type GeminiResumeTailoringServiceOptions = {
  client?: GoogleGenAI;
  apiKey?: string;
  model?: string;
  maxRetries?: number;
};

export class GeminiResumeTailoringService implements LlmResumeTailoringService {
  constructor(private readonly options: GeminiResumeTailoringServiceOptions = {}) {}

  async tailorResume(input: LlmResumeTailoringInput): Promise<LlmResumeTailoringOutput> {
    const apiKey = this.options.apiKey ?? process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const model = this.options.model ?? (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL);
    const ai = this.options.client ?? new GoogleGenAI({ apiKey });
    const maxRetries = this.options.maxRetries ?? DEFAULT_MAX_RETRIES;

    let rawText = "";
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: buildGeminiPrompt(input),
          config: { responseMimeType: "application/json" },
        });
        rawText = response.text?.trim() ?? "";
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries && isRetryableGeminiError(error)) {
          // Exponential backoff with jitter: ~0.5s, 1s, 2s, ...
          const backoffMs = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
          await sleep(backoffMs);
          continue;
        }
        break;
      }
    }

    if (lastError !== undefined) {
      const detail = lastError instanceof Error ? lastError.message : "Unknown Gemini error";
      if (isRetryableGeminiError(lastError)) {
        throw new Error(
          `Gemini is temporarily unavailable after ${maxRetries + 1} attempts (high demand). Please try again in a moment. Details: ${detail}`,
        );
      }
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
      const snippet = rawText.length > 300 ? `${rawText.slice(0, 300)}…` : rawText;
      throw new Error(`Gemini response could not be parsed as JSON. Received: ${snippet}`);
    }

    assertLlmOutputShape(parsed);

    return {
      tailoredText: parsed.tailoredText.trim(),
      tailoringNotes: parsed.tailoringNotes,
      keywordCoverage: parsed.keywordCoverage,
    };
  }
}
