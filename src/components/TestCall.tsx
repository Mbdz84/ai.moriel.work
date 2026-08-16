"use client";

import { useRef, useState } from "react";

// In-browser test call to the live Vapi assistant, so an admin can hear the
// agent before real calls come in. Uses the Vapi Web SDK loaded from a CDN at
// runtime (kept out of the bundler) + the public key (NEXT_PUBLIC_VAPI_PUBLIC_KEY).

type VapiClient = {
  start: (assistantId: string) => Promise<unknown>;
  stop: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};
type VapiCtor = new (key: string) => VapiClient;

// Hidden from the bundler so it stays a native runtime import of a URL.
const importFromCdn = new Function("u", "return import(u)") as unknown as (
  u: string
) => Promise<{ default: VapiCtor }>;

export default function TestCall({
  assistantId,
  publicKey,
}: {
  assistantId: string;
  publicKey: string;
}) {
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">(
    "idle"
  );
  const [msg, setMsg] = useState("");
  const vapiRef = useRef<VapiClient | null>(null);

  const disabled = !assistantId || !publicKey;

  async function start() {
    setMsg("");
    setStatus("connecting");
    try {
      if (!vapiRef.current) {
        const mod = await importFromCdn("https://esm.sh/@vapi-ai/web@2");
        const Vapi = mod.default;
        const v = new Vapi(publicKey);
        v.on("call-start", () => setStatus("live"));
        v.on("call-end", () => setStatus("idle"));
        v.on("error", (e: unknown) => {
          setStatus("error");
          const m = (e as { message?: string })?.message;
          setMsg(m || "Call error");
        });
        vapiRef.current = v;
      }
      await vapiRef.current.start(assistantId);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Could not start the call");
    }
  }

  function stop() {
    vapiRef.current?.stop();
    setStatus("idle");
  }

  const live = status === "live" || status === "connecting";

  return (
    <div className="rounded border border-neutral-200 p-3 space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={live ? stop : start}
          disabled={disabled}
          className={`rounded px-4 py-2 text-sm text-white disabled:opacity-40 ${
            live ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {status === "connecting"
            ? "Connecting…"
            : status === "live"
            ? "End test call"
            : "Test call your agent"}
        </button>
        <span className="text-xs text-neutral-500">
          {status === "live"
            ? "Live — talk into your mic."
            : "Uses your browser mic. Save changes first to test the latest version."}
        </span>
      </div>
      {disabled && (
        <p className="text-xs text-amber-600">
          {!assistantId
            ? "Add and save a Vapi Assistant ID to enable the test call."
            : "Set NEXT_PUBLIC_VAPI_PUBLIC_KEY to enable the test call."}
        </p>
      )}
      {status === "error" && msg && (
        <p className="text-xs text-red-600">{msg}</p>
      )}
    </div>
  );
}
