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

function extractParagraphProperties(documentXml: string): string {
  const firstParagraphMatch = documentXml.match(/<w:p[\s\S]*?<\/w:p>/);
  if (!firstParagraphMatch) {
    return "";
  }

  const paragraphPropertiesMatch = firstParagraphMatch[0].match(/<w:pPr[\s\S]*?<\/w:pPr>/);
  return paragraphPropertiesMatch?.[0] ?? "";
}

function buildParagraphXml(text: string, paragraphProperties: string): string {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const runs = lines
        .map((line, index) => {
          const escaped = xmlEscape(line);
          const lineXml = `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
          return index === 0 ? lineXml : `<w:r><w:br/></w:r>${lineXml}`;
        })
        .join("");

      return `<w:p>${paragraphProperties}${runs}</w:p>`;
    })
    .join("");
}

function insertTailoredParagraphs(documentXml: string, tailoredParagraphXml: string): string {
  const bodyMatch = documentXml.match(/<w:body[\s\S]*?<\/w:body>/);
  if (!bodyMatch) {
    throw new Error("DOCX document body was not found.");
  }

  const bodyXml = bodyMatch[0];
  const sectPrMatch = bodyXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);

  const updatedBody = sectPrMatch
    ? bodyXml.replace(sectPrMatch[0], `${tailoredParagraphXml}${sectPrMatch[0]}`)
    : bodyXml.replace("</w:body>", `${tailoredParagraphXml}</w:body>`);

  return documentXml.replace(bodyXml, updatedBody);
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
  const paragraphProperties = extractParagraphProperties(documentXml);
  const tailoredParagraphXml = buildParagraphXml(input.tailoredText, paragraphProperties);
  const updatedDocumentXml = insertTailoredParagraphs(documentXml, tailoredParagraphXml);

  zip.file("word/document.xml", updatedDocumentXml);
  return zip.generateAsync({ type: "nodebuffer" });
}