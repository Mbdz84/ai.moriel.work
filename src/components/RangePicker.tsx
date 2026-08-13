"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { computeRange, RANGE_LABELS } from "@/lib/date-range";

// Date-range dropdown. Computes start/end in the browser's local timezone and
// pushes explicit ISO timestamps to the server via the URL.
export default function RangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("range") ?? "this_month";

  const [cf, setCf] = useState(sp.get("cf") ?? "");
  const [ct, setCt] = useState(sp.get("ct") ?? "");
  const [showCustom, setShowCustom] = useState(current === "custom");

  function go(key: string, from?: string, to?: string) {
    const r = computeRange(key, from, to);
    const p = new URLSearchParams();
    p.set("range", key);
    p.set("from", r.start.toISOString());
    p.set("to", r.end.toISOString());
    if (key === "custom") {
      if (from) p.set("cf", from);
      if (to) p.set("ct", to);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    go(v);
  }

  const field = "text-sm border border-neutral-300 rounded px-2 py-1 bg-white";

  // Resolve the dates currently in effect to show them to the user.
  const from = sp.get("from");
  const to = sp.get("to");
  const eff =
    from && to
      ? { start: new Date(from), end: new Date(to) }
      : computeRange(current, cf, ct);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const sameDay = eff.start.toDateString() === eff.end.toDateString();
  const dateLabel = sameDay ? fmt(eff.start) : `${fmt(eff.start)} – ${fmt(eff.end)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={current} onChange={onSelect} className={field}>
        {Object.entries(RANGE_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <span className="text-xs text-neutral-500">{dateLabel}</span>
      {showCustom && (
        <>
          <input
            type="date"
            value={cf}
            onChange={(e) => setCf(e.target.value)}
            className={field}
          />
          <span className="text-neutral-400">–</span>
          <input
            type="date"
            value={ct}
            onChange={(e) => setCt(e.target.value)}
            className={field}
          />
          <button
            onClick={() => cf && ct && go("custom", cf, ct)}
            className="text-sm rounded bg-black text-white px-3 py-1"
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
