import type { LlmResumeTailoringService } from "@/lib/llm/types";
import { GeminiResumeTailoringService } from "@/lib/llm/gemini-service";

export function getLlmResumeTailoringService(): LlmResumeTailoringService {
  return new GeminiResumeTailoringService();
}
