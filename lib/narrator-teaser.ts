import "server-only";

import { generateNarrationAudio } from "@/lib/elevenlabs";

export const NARRATOR_TEASER_TEXT = "Did you summon me, invocator?";

let cachedTeaserAudioUrl: string | null = null;

export async function getNarratorTeaserAudioUrl() {
  if (cachedTeaserAudioUrl) {
    return cachedTeaserAudioUrl;
  }

  const audioUrl = await generateNarrationAudio(NARRATOR_TEASER_TEXT, { pageNumber: "teaser" });
  if (audioUrl) {
    cachedTeaserAudioUrl = audioUrl;
  }

  return audioUrl;
}
