// Weekly business-hours model, shared by the settings editor and the prompt
// builder. Stored on agents.business_hours as JSON:
//   { "mon": [{ "open": "08:00", "close": "17:00" }], "sat": [], ... }
// A day with no ranges (or missing) is treated as closed.

export type TimeRange = { open: string; close: string };
export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type BusinessHours = Partial<Record<DayKey, TimeRange[]>>;

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS: Record<DayKey, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

// A short, sensible set of zones for the picker (label -> IANA id).
export const TIME_ZONES: { id: string; label: string }[] = [
  { id: "America/New_York", label: "Eastern (New York)" },
  { id: "America/Chicago", label: "Central (Chicago)" },
  { id: "America/Denver", label: "Mountain (Denver)" },
  { id: "America/Phoenix", label: "Arizona (Phoenix)" },
  { id: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { id: "America/Anchorage", label: "Alaska (Anchorage)" },
  { id: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { id: "Europe/London", label: "UK (London)" },
];

// "08:00" -> "8:00 AM"
export function fmtTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

// Human-readable weekly schedule for the system prompt.
export function describeHours(hours: BusinessHours): string {
  const lines: string[] = [];
  for (const day of DAY_KEYS) {
    const ranges = hours[day] ?? [];
    const valid = ranges.filter((r) => r.open && r.close);
    if (valid.length === 0) {
      lines.push(`${DAY_LABELS[day]}: closed`);
    } else {
      lines.push(
        `${DAY_LABELS[day]}: ${valid
          .map((r) => `${fmtTime(r.open)}–${fmtTime(r.close)}`)
          .join(", ")}`
      );
    }
  }
  return lines.join("\n");
}

// Is the business open right now, in its own time zone? Returns null if the
// schedule is empty (so callers can treat "unknown" distinctly from "closed").
export function isOpenNow(
  hours: BusinessHours,
  tz: string,
  now: Date = new Date()
): boolean | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "America/Chicago",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const wd = get("weekday").toLowerCase().slice(0, 3) as DayKey;
    const cur = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
    const ranges = hours[wd] ?? [];
    for (const r of ranges) {
      const [oh, om] = r.open.split(":").map((n) => parseInt(n, 10));
      const [ch, cm] = r.close.split(":").map((n) => parseInt(n, 10));
      if (isNaN(oh) || isNaN(ch)) continue;
      const open = oh * 60 + om;
      const close = ch * 60 + cm;
      if (cur >= open && cur < close) return true;
    }
    return false;
  } catch {
    return null;
  }
}
