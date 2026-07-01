import "server-only";

import { NO_DASH_WRITING_RULE } from "@/lib/clean-generated-text";
import { openai } from "@/lib/server/openai";
import { TEXT_MODEL } from "@/lib/server/generation-config";
import type { BookPage, LoreBook } from "@/lib/types";

function getResponseText(response: unknown) {
  const typed = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typed.output_text?.trim()) {
    return typed.output_text;
  }

  return (
    typed.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("")
      .trim() || ""
  );
}

function extractJsonPayload(text: string) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);

  if (start === -1) {
    throw new Error("Repair response did not return JSON.");
  }

  const opener = trimmed[start];
  const closer = opener === "[" ? "]" : "}";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === opener) {
      depth += 1;
    }

    if (character === closer) {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  const end = trimmed.lastIndexOf(closer);
  if (end <= start) {
    throw new Error("Repair response did not return JSON.");
  }

  return trimmed.slice(start, end + 1);
}

function parseRepairedPages(rawText: string, expectedPageNumbers: number[]): BookPage[] {
  const payload = JSON.parse(extractJsonPayload(rawText)) as
    | BookPage[]
    | { repairedPages?: BookPage[]; pages?: BookPage[] };

  const source = Array.isArray(payload) ? payload : payload.repairedPages || payload.pages;
  if (!Array.isArray(source) || !source.length) {
    throw new Error("Meta text repair returned no pages.");
  }

  const repairedByNumber = new Map<number, BookPage>();

  for (const page of source) {
    const pageNumber = Number(page.pageNumber);
    if (!expectedPageNumbers.includes(pageNumber)) {
      continue;
    }

    if (!page.title?.trim() || !page.text?.trim() || !page.imagePrompt?.trim()) {
      throw new Error(`Repaired page ${pageNumber} is missing required fields.`);
    }

    repairedByNumber.set(pageNumber, {
      pageNumber,
      chapter: page.chapter || `Chapter ${pageNumber}`,
      title: page.title.trim(),
      text: page.text.trim(),
      imagePrompt: page.imagePrompt.trim(),
      visualDirection: page.visualDirection,
      imageUrl: page.imageUrl,
      audioUrl: page.audioUrl,
    });
  }

  const missing = expectedPageNumbers.filter((pageNumber) => !repairedByNumber.has(pageNumber));
  if (missing.length > 0) {
    throw new Error(`Meta text repair did not return pages: ${missing.join(", ")}`);
  }

  return expectedPageNumbers.map((pageNumber) => repairedByNumber.get(pageNumber)!);
}

export async function repairMetaTextPages(book: Partial<LoreBook>, invalidPageNumbers: number[]) {
  const uniquePageNumbers = Array.from(new Set(invalidPageNumbers)).sort((left, right) => left - right);
  if (!uniquePageNumbers.length || !book.pages?.length) {
    return book;
  }

  const model = TEXT_MODEL;
  const system = `You repair generated Runeterra-inspired biography pages.
You rewrite only the invalid pages so they become fully immersive in-world lore.
You preserve story continuity, character identity, region, champion connection, and tone.
${NO_DASH_WRITING_RULE}
You return strict JSON only.`;

  const user = `The following book pages contain immersion-breaking meta text.
Rewrite only these pages.

Invalid page numbers:
${uniquePageNumbers.join(", ")}

Current book:
${JSON.stringify(book, null, 2)}

Rules:
- Do not mention page numbers inside visible text.
- Do not mention chapters inside visible text except the separate title field can remain a title.
- Do not mention biography mechanics.
- Do not mention the reader.
- Do not mention the user.
- Do not mention the story structure.
- Do not mention next page or previous page.
- Do not mention unlock, payment, paid, prompt, AI, generated, or JSON.
- Do not use em dashes, en dashes, or dash-separated clauses.
- Keep each page between 55 and 95 words.
- Keep the text immersive and written like official champion biography prose.
- Keep the story easy to understand.
- Keep page 5 connected to the existing League champion.
- Keep page 5 ending as a strong cliffhanger when page 5 is included.
- Return only a JSON object with a repairedPages array.

Expected output:
{
  "repairedPages": [
    {
      "pageNumber": 3,
      "title": "...",
      "text": "...",
      "imagePrompt": "..."
    }
  ]
}

Do not include markdown.
Do not include explanations.`;

  const response = await openai.responses.create({
    model,
    instructions: `${system}\nReturn only one valid JSON object. No markdown fences. No prose outside JSON.`,
    input: user,
    text: {
      format: { type: "json_object" },
      verbosity: "medium",
    },
    max_output_tokens: 2200,
  });

  const rawText = getResponseText(response);
  if (!rawText) {
    throw new Error("Meta text repair returned an empty response.");
  }

  const repairedPages = parseRepairedPages(rawText, uniquePageNumbers);
  const workingBook: Partial<LoreBook> = {
    ...book,
    pages: book.pages ? [...book.pages] : [],
  };

  for (const repairedPage of repairedPages) {
    const index = workingBook.pages!.findIndex(
      (page, pageIndex) => (page.pageNumber ?? pageIndex + 1) === repairedPage.pageNumber,
    );
    if (index === -1) {
      throw new Error(`Unable to merge repaired page ${repairedPage.pageNumber}.`);
    }
    workingBook.pages![index] = {
      ...workingBook.pages![index],
      ...repairedPage,
    };
  }

  return workingBook;
}
