import mammoth from "mammoth";

function normalizeExtractedDocxText(rawText: string): string {
  const lines = rawText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim());

  const normalizedLines: string[] = [];
  let previousWasBlank = false;

  for (const line of lines) {
    if (!line) {
      if (!previousWasBlank && normalizedLines.length > 0) {
        normalizedLines.push("");
      }
      previousWasBlank = true;
      continue;
    }

    normalizedLines.push(line);
    previousWasBlank = false;
  }

  return normalizedLines.join("\n").trim();
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const extracted = await mammoth.extractRawText({ buffer });
    return normalizeExtractedDocxText(extracted.value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to extract text from DOCX file: ${detail}`);
  }
}