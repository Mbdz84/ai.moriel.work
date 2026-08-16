"use client";

import { useState } from "react";
import {
  DAY_KEYS,
  DAY_LABELS,
  TIME_ZONES,
  type BusinessHours,
  type DayKey,
  type TimeRange,
} from "@/lib/hours";

// Weekly hours editor. Serializes the schedule into a hidden business_hours
// JSON input; also renders hours_enabled / timezone / after_hours_prompt so the
// whole block posts with the agent form.
export default function BusinessHoursEditor({
  initial,
  enabled,
  timezone,
  afterHours,
}: {
  initial: BusinessHours;
  enabled: boolean;
  timezone: string;
  afterHours: string;
}) {
  const [hours, setHours] = useState<BusinessHours>(initial || {});
  const [on, setOn] = useState(enabled);

  const input = "rounded border border-neutral-300 px-2 py-1 text-sm";

  function setRanges(day: DayKey, ranges: TimeRange[]) {
    setHours((h) => ({ ...h, [day]: ranges }));
  }
  function addRange(day: DayKey) {
    const cur = hours[day] ?? [];
    setRanges(day, [...cur, { open: "09:00", close: "17:00" }]);
  }
  function removeRange(day: DayKey, i: number) {
    const cur = hours[day] ?? [];
    setRanges(
      day,
      cur.filter((_, idx) => idx !== i)
    );
  }
  function updateRange(day: DayKey, i: number, key: keyof TimeRange, v: string) {
    const cur = hours[day] ?? [];
    setRanges(
      day,
      cur.map((r, idx) => (idx === i ? { ...r, [key]: v } : r))
    );
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="business_hours" value={JSON.stringify(hours)} />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="hours_enabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
        Use business hours (the agent tells callers when you&apos;re open and
        applies after-hours handling)
      </label>

      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-600">Time zone</label>
        <select name="timezone" defaultValue={timezone} className={input}>
          {TIME_ZONES.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </select>
      </div>

      <div className={`space-y-2 ${on ? "" : "opacity-50"}`}>
        {DAY_KEYS.map((day) => {
          const ranges = hours[day] ?? [];
          return (
            <div key={day} className="flex flex-wrap items-center gap-2">
              <span className="w-24 text-sm text-neutral-700">
                {DAY_LABELS[day]}
              </span>
              {ranges.length === 0 && (
                <span className="text-sm text-neutral-400">Closed</span>
              )}
              {ranges.map((r, i) => (
                <span key={i} className="flex items-center gap-1">
                  <input
                    type="time"
                    value={r.open}
                    onChange={(e) => updateRange(day, i, "open", e.target.value)}
                    className={input}
                  />
                  <span className="text-neutral-400">–</span>
                  <input
                    type="time"
                    value={r.close}
                    onChange={(e) => updateRange(day, i, "close", e.target.value)}
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() => removeRange(day, i)}
                    className="rounded border border-neutral-300 px-2 text-sm hover:bg-neutral-100"
                    aria-label="Remove hours"
                  >
                    −
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => addRange(day)}
                className="text-sm text-neutral-600 hover:text-black"
              >
                + hours
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-neutral-700">
          After-hours instruction
        </label>
        <textarea
          name="after_hours_prompt"
          defaultValue={afterHours}
          placeholder="e.g. Take a message and tell the caller a technician will call back in the morning. For a true emergency (no heat, active leak, car lockout), say we still dispatch and collect the details."
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm min-h-24"
        />
      </div>
    </div>
  );
}
