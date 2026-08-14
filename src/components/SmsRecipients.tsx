"use client";

import { useState } from "react";

// Dynamic list of SMS destination numbers. Each input is named "sms_to" so
// the server action reads them with formData.getAll("sms_to").
export default function SmsRecipients({ initial }: { initial: string[] }) {
  const [numbers, setNumbers] = useState<string[]>(
    initial.length ? initial : [""]
  );

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";

  function update(i: number, v: string) {
    setNumbers((arr) => arr.map((n, idx) => (idx === i ? v : n)));
  }
  function add() {
    setNumbers((arr) => [...arr, ""]);
  }
  function remove(i: number) {
    setNumbers((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }

  return (
    <div className="space-y-2">
      {numbers.map((n, i) => (
        <div key={i} className="flex gap-2">
          <input
            name="sms_to"
            value={n}
            onChange={(e) => update(i, e.target.value)}
            placeholder="+1..."
            className={input}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded border border-neutral-300 px-3 text-sm hover:bg-neutral-100"
            aria-label="Remove number"
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
        + Add another number
      </button>
    </div>
  );
}
