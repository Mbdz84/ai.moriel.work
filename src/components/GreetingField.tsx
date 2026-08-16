"use client";

import { useState } from "react";

// Greeting textarea + live "how it sounds" preview. Supports {business} and
// {agent} tokens, substituted in the preview and (server-side) before the
// greeting is pushed to Vapi.
export default function GreetingField({
  initial,
  businessName,
  agentName,
}: {
  initial: string;
  businessName: string;
  agentName: string;
}) {
  const [text, setText] = useState(initial);

  const preview = (text || "")
    .replace(/\{business\}/g, businessName || "your business")
    .replace(/\{agent\}/g, agentName || "the agent")
    .trim();

  const area = "w-full rounded border border-neutral-300 px-3 py-2 text-sm min-h-24";

  function insert(token: string) {
    setText((s) => `${s}${s && !s.endsWith(" ") ? " " : ""}${token}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-2">
        <textarea
          name="greeting"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={area}
        />
        <div className="flex flex-wrap gap-1.5">
          {["{business}", "{agent}"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => insert(t)}
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs font-mono text-neutral-600 hover:bg-neutral-100"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700">
          How callers hear it
        </span>
        <div className="rounded-2xl rounded-tl-sm bg-neutral-100 p-3 text-sm text-neutral-800">
          {preview || "—"}
        </div>
      </div>
    </div>
  );
}
