import { titleize } from "./sms-template";

// Builds a short one-liner for the SMS, e.g.
//   "2015 Mercedes-Benz C-Class key made"
//   "House lockout"
// The full free-text notes are still stored and shown in the dashboard; this
// is only for the concise SMS line.

const SERVICE_SHORT: Record<string, string> = {
  car_key_replacement: "key made",
  key_replacement: "key made",
  car_key: "key made",
  car_lockout: "lockout",
  house_lockout: "lockout",
  lockout: "lockout",
  rekey: "rekey",
  new_locks: "new locks",
  lock_change: "lock change",
  ignition_repair: "ignition repair",
  ignition: "ignition repair",
};

function serviceShort(serviceType?: string | null): string {
  if (!serviceType) return "";
  const key = serviceType.toLowerCase().trim().replace(/\s+/g, "_");
  if (SERVICE_SHORT[key]) return SERVICE_SHORT[key];
  if (key.includes("lockout")) return "lockout";
  if (key.includes("rekey")) return "rekey";
  if (key.includes("ignition")) return "ignition repair";
  if (key.includes("key")) return "key made";
  if (key.includes("lock")) return "lock change";
  return titleize(serviceType);
}

// Pull a "2015 Mercedes-Benz C-Class"-style vehicle string out of free text:
// a 4-digit year followed by the make/model up to the next sentence break.
export function parseVehicle(text?: string | null): string {
  if (!text) return "";
  const m = text.match(/\b(?:19|20)\d{2}\b[^.,;\n]*/);
  return m ? m[0].trim().replace(/\s+/g, " ") : "";
}

export function buildJobSummary(data: {
  vehicle?: string | null;
  notes?: string | null;
  service_type?: string | null;
  property_type?: string | null;
}): string {
  const svc = serviceShort(data.service_type);
  const vehicle =
    (data.vehicle && data.vehicle.trim()) || parseVehicle(data.notes);

  // Cars: "<year make model> <service>" (e.g. "2015 Mercedes-Benz C-Class key made").
  if (vehicle) return [vehicle, svc].filter(Boolean).join(" ");

  // Non-vehicle jobs: "<property> <service>" (e.g. "House lockout").
  const prop = titleize(data.property_type);
  return [prop, svc].filter(Boolean).join(" ").trim();
}
