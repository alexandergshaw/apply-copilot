import { Document, Packer, Paragraph, TextRun } from "docx";

type CreateTailoredResumeDocxInput = {
  tailoredText: string;
};

function toParagraphs(text: string): Paragraph[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) =>
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun(block)],
    }),
  );
}

export async function createTailoredResumeDocx(
  input: CreateTailoredResumeDocxInput,
): Promise<Buffer> {
  // TODO: Preserve original styles from source DOCX when generating tailored drafts.
  // TODO: Consider direct DOCX XML editing for in-place, section-aware replacements.
  // TODO: Support section-aware replacement strategies instead of full text regeneration.
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: toParagraphs(input.tailoredText),
      },
    ],
  });

  return Packer.toBuffer(doc);
}