"use client";

import { useState } from "react";
import type { CollectField } from "@/lib/agent-prompt";

// The list of details the agent must collect from every caller. Serialized
// into a hidden collect_fields JSON input; also injected into the prompt.
export default function CollectFieldsEditor({
  initial,
}: {
  initial: CollectField[];
}) {
  const [fields, setFields] = useState<CollectField[]>(initial);

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";

  function update(i: number, patch: Partial<CollectField>) {
    setFields((arr) => arr.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function add() {
    setFields((arr) => [...arr, { label: "", required: true }]);
  }
  function remove(i: number) {
    setFields((arr) => arr.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name="collect_fields"
        value={JSON.stringify(fields.filter((f) => f.label.trim()))}
      />
      {fields.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={f.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Detail to collect — e.g. Best callback number"
            className={input}
          />
          <label className="flex items-center gap-1 text-xs text-neutral-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={f.required ?? false}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            required
          </label>
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded border border-neutral-300 px-3 text-sm hover:bg-neutral-100"
            aria-label="Remove detail"
          >
            −
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-neutral-600 hover:text-black"
      >
        + Add detail
      </button>
    </div>
  );
}
