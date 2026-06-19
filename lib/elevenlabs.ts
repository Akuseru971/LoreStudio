import { dataUrlFromBase64, sanitizeText } from "@/lib/utils";

const DEFAULT_ELEVENLABS_VOICE_ID = "t9VKj6QDu6evrQNoV6Ij";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_v3";

export async function generateNarrationAudio(text: string) {
  const buffer = await generateNarrationAudioBuffer(text);
  if (!buffer) {
    return null;
  }

  return dataUrlFromBase64(buffer.toString("base64"), "audio/mpeg");
}

export async function generateNarrationAudioBuffer(text: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL_ID;

  if (!apiKey) {
    return null;
  }

  const safeText = sanitizeText(text, 900);
  if (!safeText) {
    return null;
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
