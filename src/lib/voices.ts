// Voice catalog for the agent voice picker.
// If ELEVENLABS_API_KEY is set we return the live library (with audio
// previews); otherwise we fall back to a curated set of stable ElevenLabs
// "premade" voices. Vapi's provider id for ElevenLabs is "11labs".

export type Voice = {
  id: string;
  name: string;
  gender: string;
  provider: string;
  previewUrl?: string;
  description?: string;
};

// Stable premade ElevenLabs voice ids. No preview URLs here (those rotate) —
// callers hear them via the in-app test call. When an API key is present we
// use the live list below instead, which includes previews.
export const CURATED_VOICES: Voice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female", provider: "11labs", description: "Calm, warm" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", provider: "11labs", description: "Soft, professional" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", gender: "female", provider: "11labs", description: "Friendly, upbeat" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", provider: "11labs", description: "Clear, youthful" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male", provider: "11labs", description: "Deep, steady" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male", provider: "11labs", description: "Warm, natural" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", provider: "11labs", description: "Mature, calm" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", provider: "11labs", description: "Crisp, professional" },
];

type ElVoice = {
  voice_id: string;
  name: string;
  preview_url?: string;
  labels?: Record<string, string>;
};

export async function listVoices(): Promise<Voice[]> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return CURATED_VOICES;
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
      cache: "no-store",
    });
    if (!r.ok) return CURATED_VOICES;
    const d = (await r.json()) as { voices?: ElVoice[] };
    const voices: Voice[] = (d.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender ?? "",
      provider: "11labs",
      previewUrl: v.preview_url,
      description: [v.labels?.accent, v.labels?.description]
        .filter(Boolean)
        .join(", "),
    }));
    return voices.length ? voices : CURATED_VOICES;
  } catch {
    return CURATED_VOICES;
  }
}
