import { getLlmResumeTailoringService } from "@/lib/llm/service";
import type {
  LlmResumeTailoringInput,
  LlmResumeTailoringOutput,
} from "@/lib/llm/types";

// Backward-compatible wrapper: callers should depend on the service abstraction.
export async function tailorResumeWithGemini(
  input: LlmResumeTailoringInput,
): Promise<LlmResumeTailoringOutput> {
  return getLlmResumeTailoringService().tailorResume(input);
}
