/**
 * OpenAI SDK must only be imported from server-only files or API routes.
 * Never import OpenAI in any file with "use client".
 */
import "server-only";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
