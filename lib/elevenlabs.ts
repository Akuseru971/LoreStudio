import { dataUrlFromBase64, sanitizeText } from "@/lib/utils";

const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_v3";
const DEFAULT_ELEVENLABS_VOICE_ID = "t9VKj6QDu6evrQNoV6Ij";

export function getElevenLabsVoiceId() {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_ELEVENLABS_VOICE_ID;
}

function getElevenLabsModelId() {
  return process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_ELEVENLABS_MODEL_ID;
}

type GenerateNarrationOptions = {
  pageNumber?: number | string;
};

export async function generateNarrationAudio(text: string, options: GenerateNarrationOptions = {}) {
  const buffer = await generateNarrationAudioBuffer(text, options);
  if (!buffer) {
    return null;
  }

  return dataUrlFromBase64(buffer.toString("base64"), "audio/mpeg");
}

export async function generateNarrationAudioBuffer(text: string, options: GenerateNarrationOptions = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const voiceId = getElevenLabsVoiceId();
  const modelId = getElevenLabsModelId();
  const pageLabel = options.pageNumber ?? "preview";

  console.log("[AUDIO] Generating page", pageLabel, "with voice", voiceId);

  const safeText = sanitizeText(text, 900);
  if (!safeText) {
    throw new Error("Narration text is empty.");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: safeText,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.85,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs request failed with ${response.status}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return audioBuffer;
}
