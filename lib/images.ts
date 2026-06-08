import { buildFinalImagePrompt } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import type { BookPage, LoreBook } from "@/lib/types";
import { dataUrlFromBase64 } from "@/lib/utils";

export async function generateBookPageImage(book: LoreBook, page: BookPage) {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
  const prompt = buildFinalImagePrompt(book, page);

  try {
    const response = await openai.images.generate(
      {
        model,
        prompt,
        size: size as "1024x1024" | "1024x1536" | "1536x1024",
        response_format: "b64_json",
      },
      {
        timeout: 45000,
      },
    );

    const image = response.data?.[0];
    if (image?.b64_json) {
      return dataUrlFromBase64(image.b64_json, "image/png");
    }

    if (image?.url) {
      return image.url;
    }
  } catch (error) {
    console.warn(`Image generation failed for page ${page.pageNumber}.`, error);
  }

  return undefined;
}
