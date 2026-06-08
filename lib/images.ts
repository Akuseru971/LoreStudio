import { buildFinalImagePrompt } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import type { BookPage, LoreBook } from "@/lib/types";
import { dataUrlFromBase64 } from "@/lib/utils";

export async function generateBookPageImage(book: LoreBook, page: BookPage) {
  const requestedModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const models = Array.from(new Set([requestedModel, "gpt-image-1"]));
  const requestedSize = process.env.OPENAI_IMAGE_SIZE || "1024x1536";
  const sizes = Array.from(new Set([requestedSize, "1024x1024"]));
  const prompt = buildFinalImagePrompt(book, page);

  for (const model of models) {
    for (const size of sizes) {
      try {
        const isGptImageModel = model.startsWith("gpt-image");
        const response = await openai.images.generate(
          {
            model,
            prompt,
            size: size as "1024x1024" | "1024x1536" | "1536x1024",
            ...(!isGptImageModel ? { response_format: "b64_json" as const } : {}),
          },
          {
            timeout: 120000,
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
        console.warn(`Image generation failed for page ${page.pageNumber} with ${model}/${size}.`, error);
      }
    }
  }

  return undefined;
}
