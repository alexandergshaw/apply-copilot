import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import JSZip from "jszip";

type CreateTailoredResumeDocxInput = {
  sourceDocxBuffer: Buffer;
  tailoredText: string;
};

function splitTailoredText(tailoredText: string): string[] {
  const lines = tailoredText.replace(/\r\n/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.length > 0 ? lines : [""];
}

function splitTextAcrossWeights(text: string, weights: number[]): string[] {
  if (weights.length === 0) {
    return [];
  }

  if (weights.length === 1) {
    return [text];
  }

  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0);
  if (totalWeight <= 0) {
    return weights.map((_, index) => (index === 0 ? text : ""));
  }

  const allocations = weights.map((weight) =>
    Math.floor((text.length * Math.max(weight, 0)) / totalWeight),
  );
  let allocatedLength = allocations.reduce((sum, length) => sum + length, 0);

  for (let index = 0; allocatedLength < text.length; index += 1) {
    allocations[index % allocations.length] += 1;
    allocatedLength += 1;
  }

  const segments: string[] = [];
  let offset = 0;
  for (const length of allocations) {
    segments.push(text.slice(offset, offset + length));
    offset += length;
  }

  return segments;
}

function replaceParagraphText(
  $: cheerio.CheerioAPI,
  paragraph: cheerio.Cheerio<AnyNode>,
  text: string,
): void {
  const textNodes = paragraph.find("w\\:t").toArray();
  if (textNodes.length === 0) {
    const firstRun = paragraph.children("w\\:r").first();
    if (firstRun.length > 0) {
      const textNode = $("<w:t xml:space=\"preserve\"></w:t>");
      textNode.text(text);
      firstRun.append(textNode);
    } else {
      const run = $("<w:r><w:t xml:space=\"preserve\"></w:t></w:r>");
      run.find("w\\:t").text(text);
      paragraph.append(run);
    }
    return;
  }

  const weights = textNodes.map((node) => $(node).text().length);
  const segments = splitTextAcrossWeights(text, weights);

  textNodes.forEach((node, index) => {
    const textNode = $(node);
    textNode.attr("xml:space", "preserve");
    textNode.text(segments[index] ?? "");
  });
}

function replaceBodyContent(documentXml: string, tailoredText: string): string {
  const $ = cheerio.load(documentXml, { xmlMode: true });
  const body = $("w\\:body").first();
  if (body.length === 0) {
    throw new Error("DOCX document body was not found.");
  }

  const paragraphs = body.find("w\\:p").toArray().map((paragraph) => $(paragraph));
  const lines = splitTailoredText(tailoredText);

  if (paragraphs.length === 0) {
    const sectPr = body.children("w\\:sectPr").first();
    for (const line of lines) {
      const paragraph = $(
        `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`,
      );
      if (sectPr.length > 0) {
        sectPr.before(paragraph);
      } else {
        body.append(paragraph);
      }
    }

    return $.xml();
  }

  const lastParagraph = paragraphs[paragraphs.length - 1];
  const sectPr = body.children("w\\:sectPr").first();

  lines.forEach((line, index) => {
    if (index < paragraphs.length) {
      replaceParagraphText($, paragraphs[index], line);
      return;
    }

    const clonedParagraph = lastParagraph.clone();
    replaceParagraphText($, clonedParagraph, line);
    if (sectPr.length > 0) {
      sectPr.before(clonedParagraph);
    } else {
      body.append(clonedParagraph);
    }
  });

  for (let index = lines.length; index < paragraphs.length; index += 1) {
    replaceParagraphText($, paragraphs[index], "");
  }

  return $.xml();
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