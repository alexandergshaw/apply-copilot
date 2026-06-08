import type {
  ResumeTailoringJob,
  ResumeTailoringLlmOutput,
} from "@/lib/resume-tailoring/types";

export type LlmResumeTailoringInput = {
  job: ResumeTailoringJob;
  resumeText: string;
  profile?: unknown;
};

export type LlmResumeTailoringOutput = ResumeTailoringLlmOutput;

export interface LlmResumeTailoringService {
  tailorResume(input: LlmResumeTailoringInput): Promise<LlmResumeTailoringOutput>;
}
