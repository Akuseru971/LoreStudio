/**
 * OpenAI SDK must only be imported from server-only files or API routes.
 * Never import OpenAI in any file with "use client".
 */
import "server-only";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function requireOpenAiApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  return apiKey;
}

export function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: requireOpenAiApiKey(),
    });
  }

  return openaiClient;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, property, receiver) {
    const client = getOpenAIClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
