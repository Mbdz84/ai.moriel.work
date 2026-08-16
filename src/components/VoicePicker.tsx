"use client";

import { useMemo, useRef, useState } from "react";
import type { Voice } from "@/lib/voices";

// Voice gallery. Selecting a card sets hidden voice_id + voice_provider inputs
// the save action reads and pushes to Vapi. Voices with a previewUrl get a
// Play button; otherwise callers hear the voice via the in-app test call.
export default function VoicePicker({
  voices,
  initialId,
  initialProvider,
}: {
  voices: Voice[];
  initialId: string;
  initialProvider: string;
}) {
  const [selId, setSelId] = useState(initialId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const selected = useMemo(
    () => voices.find((v) => v.id === selId),
    [voices, selId]
  );
  const provider = selected?.provider || initialProvider || "11labs";

  function play(v: Voice) {
    if (!v.previewUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playing === v.id) {
      setPlaying(null);
      return;
    }
    const a = new Audio(v.previewUrl);
    a.onended = () => setPlaying(null);
    audioRef.current = a;
    setPlaying(v.id);
    a.play().catch(() => setPlaying(null));
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="voice_id" value={selId} />
      <input type="hidden" name="voice_provider" value={provider} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {voices.map((v) => {
          const on = v.id === selId;
          return (
            <div
              key={v.id}
              className={`rounded border px-3 py-2 text-sm cursor-pointer ${
                on
                  ? "border-black ring-1 ring-black"
                  : "border-neutral-300 hover:bg-neutral-50"
              }`}
              onClick={() => setSelId(v.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{v.name}</span>
                {v.previewUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      play(v);
                    }}
                    className="text-xs rounded border border-neutral-300 px-1.5 py-0.5 hover:bg-neutral-100"
                    aria-label={`Play ${v.name}`}
                  >
                    {playing === v.id ? "■" : "▶"}
                  </button>
                )}
              </div>
              <div className="text-xs text-neutral-500">
                {[v.gender, v.description].filter(Boolean).join(" · ")}
              </div>
            </div>
          );
        })}
      </div>
      {!voices.some((v) => v.previewUrl) && (
        <p className="text-xs text-neutral-500">
          Set ELEVENLABS_API_KEY to preview voices here, or use the test call
          above to hear the selected voice.
        </p>
      )}
    </div>
  );
}
