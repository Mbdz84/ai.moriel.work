"use client";

import { useState } from "react";

export type Job = {
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  property_type: string | null;
  service_type: string | null;
  qualified: boolean | null;
  notes: string | null;
  dispatched_sms: boolean | null;
};

export type Call = {
  id: string;
  from_number: string | null;
  duration_sec: number | null;
  cost: number | null;
  status: string | null;
  ended_reason: string | null;
  recording_url: string | null;
  transcript: string | null;
  created_at: string;
  jobs: Job[];
};

function titleize(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Compare phone numbers by their last 10 digits (ignores formatting/+1).
function samePhone(a?: string | null, b?: string | null) {
  const n = (s?: string | null) => (s || "").replace(/\D/g, "").slice(-10);
  return n(a) && n(a) === n(b);
}

// A value is a real phone number only if it carries enough digits (guards
// against placeholder text like "same number").
function isRealPhone(s?: string | null) {
  return !!s && (s || "").replace(/\D/g, "").length >= 7;
}

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildSms(businessName: string, call: Call): string {
  const j = call.jobs?.[0];
  // Fall back to the caller ID when the collected phone isn't a real number.
  const phone = isRealPhone(j?.phone) ? j?.phone : call.from_number || j?.phone;
  return [
    businessName,
    `Name: ${j?.customer_name || "—"}`,
    `Address: ${j?.address || "—"}`,
    `Phone: ${phone || "—"}`,
    `Type: ${titleize(j?.service_type) || "—"}`,
    `Description: ${j?.notes || titleize(j?.property_type) || "—"}`,
  ].join("\n");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className="text-neutral-800">{value || "—"}</div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex-none w-9 h-9 rounded-lg bg-neutral-100 text-neutral-600 grid place-items-center text-sm font-semibold">
      {initials(name)}
    </div>
  );
}

function StatusBadge({ job }: { job?: Job }) {
  if (job?.qualified === false) {
    return (
      <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-0.5 whitespace-nowrap">
        Out of scope
      </span>
    );
  }
  if (job?.qualified === true) {
    return (
      <span className="rounded-full bg-green-100 text-green-700 text-xs font-medium px-2.5 py-0.5 whitespace-nowrap">
        Qualified
      </span>
    );
  }
  return (
    <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-0.5 whitespace-nowrap">
      New
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CallCard({
  call,
  businessName,
}: {
  call: Call;
  businessName: string;
}) {
  const j = call.jobs?.[0];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(buildSms(businessName, call));
  const [copied, setCopied] = useState(false);

  const name = j?.customer_name || call.from_number || "Unknown caller";
  const service = titleize(j?.service_type);
  const property = titleize(j?.property_type);
  const durCost = `${fmtDuration(call.duration_sec)}${
    call.cost != null ? ` · $${call.cost.toFixed(2)}` : ""
  }`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      {/* ============ DESKTOP: list row ============ */}
      <div className="hidden md:grid grid-cols-[auto_1.4fr_1.2fr_auto_auto_auto] items-center gap-4 px-4 py-3">
        <Avatar name={name} />

        <div className="min-w-0">
          <div className="font-medium truncate">{name}</div>
          <div className="text-sm text-neutral-500 truncate">
            {call.from_number || "—"}
          </div>
        </div>

        <div className="min-w-0">
          <div className="font-medium truncate">{service || "—"}</div>
          <div className="text-sm text-neutral-500 truncate">
            {j?.address || property || "—"}
          </div>
        </div>

        <div className="text-right text-sm text-neutral-500 whitespace-nowrap">
          <div>{fmtTime(call.created_at)}</div>
          <div className="tabular-nums">{durCost}</div>
        </div>

        <StatusBadge job={j} />

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-md bg-black text-white text-sm px-3 py-1.5 whitespace-nowrap"
          >
            {open ? "Close" : "Forward"}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse" : "Expand"}
            className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100"
          >
            <Chevron open={open} />
          </button>
        </div>
      </div>

      {/* ============ MOBILE: card ============ */}
      <div className="md:hidden p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={name} />
            <div className="min-w-0">
              <div className="font-medium truncate">{name}</div>
              <div className="text-sm text-neutral-500 truncate">
                {call.from_number || "—"} · {fmtTime(call.created_at)}
              </div>
            </div>
          </div>
          <StatusBadge job={j} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="Service" value={service} />
          <Field label="Property" value={property} />
          <div className="col-span-2">
            <Field label="Address" value={j?.address} />
          </div>
          <Field label="Duration" value={fmtDuration(call.duration_sec)} />
          <Field
            label="Cost"
            value={call.cost != null ? `$${call.cost.toFixed(2)}` : null}
          />
          {j?.notes && (
            <div className="col-span-2">
              <Field label="Notes" value={j.notes} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {j?.dispatched_sms ? "✓ SMS sent" : "Not texted"}
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-md bg-black text-white text-sm px-3 py-1.5"
          >
            {open ? "Close" : "Forward as text"}
          </button>
        </div>
      </div>

      {/* ============ SHARED expandable detail ============ */}
      {open && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-4 space-y-4">
          {/* Full field grid — desktop only (the mobile card already shows these) */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Field label="Caller ID" value={call.from_number} />
            {j?.phone && !samePhone(j.phone, call.from_number) && (
              <Field label="Callback #" value={j.phone} />
            )}
            <Field label="Service" value={service} />
            <Field label="Property" value={property} />
            <Field label="Duration" value={fmtDuration(call.duration_sec)} />
            <Field
              label="Cost"
              value={call.cost != null ? `$${call.cost.toFixed(2)}` : null}
            />
            <div className="col-span-2 lg:col-span-3">
              <Field label="Address" value={j?.address} />
            </div>
            {j?.notes && (
              <div className="col-span-2 lg:col-span-3">
                <Field label="Notes" value={j.notes} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT — status, recording, transcript */}
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs text-neutral-500">
                <span>
                  {call.status}
                  {call.ended_reason ? ` · ${call.ended_reason}` : ""}
                </span>
                {j?.dispatched_sms && <span>✓ SMS sent</span>}
              </div>

              {call.recording_url && (
                <audio controls preload="none" className="w-full">
                  <source src={`/api/recording/${call.id}`} />
                </audio>
              )}

              {call.transcript && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-neutral-500">
                    Transcript
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-neutral-700">
                    {call.transcript}
                  </p>
                </details>
              )}
            </div>

            {/* RIGHT — SMS to forward */}
            <div className="rounded-md border border-neutral-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">
                  Forward as text
                </span>
                <button
                  onClick={copy}
                  className="rounded bg-black text-white text-sm px-3 py-1.5"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full min-h-44 rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-mono whitespace-pre"
              />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function CallsView({
  calls,
  businessName,
}: {
  calls: Call[];
  businessName: string;
}) {
  if (calls.length === 0) {
    return (
      <p className="text-neutral-500">
        No calls yet. When your Vapi number takes a call, it will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {calls.map((call) => (
        <CallCard key={call.id} call={call} businessName={businessName} />
      ))}
    </ul>
  );
}
