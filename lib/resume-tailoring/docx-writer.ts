import JSZip from "jszip";

type CreateTailoredResumeDocxInput = {
  sourceDocxBuffer: Buffer;
  tailoredText: string;
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extracts the paragraph-level properties (`<w:pPr>`) from a single paragraph,
 * preserving its style, indentation, spacing, numbering, and list formatting.
 */
function extractParagraphProperties(paragraphXml: string): string {
  const paragraphPropertiesMatch = paragraphXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/);
  return paragraphPropertiesMatch?.[0] ?? "";
}

/**
 * Extracts the run-level properties (`<w:rPr>`) from the first run in a
 * paragraph, preserving font, size, weight, and color for replaced text.
 */
function extractFirstRunProperties(paragraphXml: string): string {
  const firstRunMatch = paragraphXml.match(/<w:r\b[\s\S]*?<\/w:r>/);
  if (!firstRunMatch) {
    return "";
  }

  const runPropertiesMatch = firstRunMatch[0].match(/<w:rPr\b[\s\S]*?<\/w:rPr>/);
  return runPropertiesMatch?.[0] ?? "";
}

/**
 * Rebuilds a paragraph using the original paragraph/run properties so the
 * tailored text inherits the template's exact formatting for that line.
 */
function buildParagraphFromTemplate(
  text: string,
  paragraphProperties: string,
  runProperties: string,
): string {
  const escaped = xmlEscape(text);
  const run = `<w:r>${runProperties}<w:t xml:space="preserve">${escaped}</w:t></w:r>`;
  return `<w:p>${paragraphProperties}${run}</w:p>`;
}

/**
 * Section-aware replacement: walks the original paragraphs in order and swaps
 * their text content with the tailored lines, preserving each paragraph's
 * formatting. Extra tailored lines reuse the last paragraph's style; unused
 * original paragraphs are dropped so no source content leaks through.
 */
function replaceBodyContent(documentXml: string, tailoredText: string): string {
  const bodyMatch = documentXml.match(/(<w:body\b[^>]*>)([\s\S]*)(<\/w:body>)/);
  if (!bodyMatch) {
    throw new Error("DOCX document body was not found.");
  }

  const [, bodyOpen, bodyInner, bodyClose] = bodyMatch;

  // Preserve a body-level <w:sectPr> (page size, margins, columns).
  const trailingSectPrMatch = bodyInner.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>\s*$/);
  const trailingSectPr = trailingSectPrMatch?.[0] ?? "";
  const contentWithoutSectPr = trailingSectPr
    ? bodyInner.slice(0, bodyInner.length - trailingSectPr.length)
    : bodyInner;

  const paragraphs = contentWithoutSectPr.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];

  // Keep empty lines so each tailored line stays positionally aligned with the
  // template paragraph at the same index (preserving section structure).
  const rawLines = tailoredText.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());
  // Drop a single trailing empty line caused by a final newline.
  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }
  const lines = rawLines;

  // No paragraphs to template from: emit minimal paragraphs so output is valid.
  if (paragraphs.length === 0) {
    const fallback = lines.map((line) => buildParagraphFromTemplate(line, "", "")).join("");
    return documentXml.replace(
      bodyMatch[0],
      `${bodyOpen}${fallback}${trailingSectPr}${bodyClose}`,
    );
  }

  const lastParagraph = paragraphs[paragraphs.length - 1];
  const lastParagraphProperties = extractParagraphProperties(lastParagraph);
  const lastRunProperties = extractFirstRunProperties(lastParagraph);

  const rebuiltParagraphs = lines.map((line, index) => {
    const templateParagraph = paragraphs[index] ?? lastParagraph;
    const paragraphProperties =
      index < paragraphs.length
        ? extractParagraphProperties(templateParagraph)
        : lastParagraphProperties;
    const runProperties =
      index < paragraphs.length
        ? extractFirstRunProperties(templateParagraph)
        : lastRunProperties;

    return buildParagraphFromTemplate(line, paragraphProperties, runProperties);
  });

  const rebuiltBody = `${bodyOpen}${rebuiltParagraphs.join("")}${trailingSectPr}${bodyClose}`;
  return documentXml.replace(bodyMatch[0], rebuiltBody);
}

export async function createTailoredResumeDocx(
  input: CreateTailoredResumeDocxInput,
): Promise<Buffer> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input.sourceDocxBuffer);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to read source DOCX package: ${detail}`);
  }

  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) {
    throw new Error("Failed to tailor DOCX: word/document.xml is missing.");
  }

  const documentXml = await documentEntry.async("string");
  const updatedDocumentXml = replaceBodyContent(documentXml, input.tailoredText);

  // styles.xml, numbering.xml, theme/*, headers/footers, and section properties
  // are intentionally left untouched so the template's formatting is preserved.
  zip.file("word/document.xml", updatedDocumentXml);
  return zip.generateAsync({ type: "nodebuffer" });
}