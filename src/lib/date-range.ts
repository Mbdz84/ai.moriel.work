// Date-range presets. Weeks run Monday 00:00 → Sunday 23:59:59.999.
// computeRange is a pure function: on the client it uses the browser's local
// timezone (the picker passes explicit ISO timestamps to the server).

export const RANGE_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
  custom: "Custom",
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
// Monday of the week containing d.
const mondayOf = (d: Date) => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - day);
  return x;
};

export function computeRange(
  key: string,
  from?: string,
  to?: string
): { start: Date; end: Date } {
  const now = new Date();
  switch (key) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "this_week": {
      const s = mondayOf(now);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { start: s, end: endOfDay(e) };
    }
    case "last_week": {
      const s = mondayOf(now);
      s.setDate(s.getDate() - 7);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return { start: s, end: endOfDay(e) };
    }
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    case "custom":
      return {
        start: from ? startOfDay(new Date(from)) : startOfDay(now),
        end: to ? endOfDay(new Date(to)) : endOfDay(now),
      };
    default: {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(s), end: endOfDay(now) };
    }
  }
}
