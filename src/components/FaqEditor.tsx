"use client";

import { useState } from "react";
import type { Faq } from "@/lib/agent-prompt";

// Q&A list the agent can answer from. Serialized into a hidden faqs JSON input.
export default function FaqEditor({ initial }: { initial: Faq[] }) {
  const [faqs, setFaqs] = useState<Faq[]>(initial.length ? initial : []);

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";

  function update(i: number, key: keyof Faq, v: string) {
    setFaqs((arr) => arr.map((f, idx) => (idx === i ? { ...f, [key]: v } : f)));
  }
  function add() {
    setFaqs((arr) => [...arr, { q: "", a: "" }]);
  }
  function remove(i: number) {
    setFaqs((arr) => arr.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="faqs" value={JSON.stringify(faqs)} />
      {faqs.map((f, i) => (
        <div
          key={i}
          className="space-y-2 rounded border border-neutral-200 p-3"
        >
          <div className="flex gap-2">
            <input
              value={f.q}
              onChange={(e) => update(i, "q", e.target.value)}
              placeholder="Question — e.g. Do you make chip keys?"
              className={input}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded border border-neutral-300 px-3 text-sm hover:bg-neutral-100"
              aria-label="Remove FAQ"
            >
              −
            </button>
          </div>
          <textarea
            value={f.a}
            onChange={(e) => update(i, "a", e.target.value)}
            placeholder="Answer the agent should give"
            className={`${input} min-h-16`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-neutral-600 hover:text-black"
      >
        + Add FAQ
      </button>
    </div>
  );
}
