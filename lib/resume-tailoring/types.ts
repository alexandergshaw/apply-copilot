export type ResumeTailoringMode = "stub" | "llm";

export type ResumeTailoringJob = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  match_score: number | null;
};

export type ResumeTailoringTemplate = {
  id: number;
  profile_id: string;
  name: string;
  target_role: string | null;
  original_filename: string | null;
  docx_storage_path: string | null;
  extracted_text: string | null;
  template_text: string | null;
  template_json: unknown | null;
};

export type ResumeTailoringInput = {
  job: ResumeTailoringJob;
  resumeTemplate: ResumeTailoringTemplate;
  sourceDocxBuffer: Buffer;
  profile?: unknown;
  mode: ResumeTailoringMode;
};

export type ResumeTailoringLlmOutput = {
  tailoredText: string;
  tailoringNotes: string;
  keywordCoverage: Record<string, unknown>;
};

export type ResumeTailoringResult = {
  tailoredText: string;
  outputDocxBuffer: Buffer;
  outputFilename: string;
  sourceDocxStoragePath: string | null;
  tailoringNotes: string;
  keywordCoverage: Record<string, unknown>;
  matchScore: number | null;
  status: "draft";
};