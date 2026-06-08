export type ExtractionSource = "json_ld" | "meta" | "html_fallback" | "manual";

export type ExtractedJobPosting = {
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  apply_url: string;
  extraction_source: ExtractionSource;
  warnings: string[];
};
