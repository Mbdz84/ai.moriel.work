"use client";

import { useState } from "react";

export type Job = {
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  property_type: string | null;
  service_type: string | null;
  urgency: string | null;
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
  return [
    businessName,
    `Name: ${j?.customer_name || "—"}`,
    `Address: ${j?.address || "—"}`,
    `Phone: ${j?.phone || call.from_number || "—"}`,
    `Type: ${titleize(j?.service_type) || "—"}`,
    `Description: ${j?.notes || titleize(j?.property_type) || "—"}`,
  ].join("\n");
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

function CallCard({
  call,
  businessName,
}: {
  call: Call;
  businessName: string;
}) {
  const j = call.jobs?.[0];
  const [draft, setDraft] = useState(buildSms(businessName, call));
  const [copied, setCopied] = useState(false);

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
    <li className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {j?.customer_name || call.from_number || "Unknown caller"}
          </span>
          {j?.urgency === "emergency" && (
            <span className="rounded bg-red-100 text-red-700 text-xs px-2 py-0.5">
              emergency
            </span>
          )}
          {j?.qualified === false && (
            <span className="rounded bg-amber-100 text-amber-700 text-xs px-2 py-0.5">
              out of scope
            </span>
          )}
        </div>
        <span className="text-sm text-neutral-400">
          {fmtTime(call.created_at)}
        </span>
      </div>

      {/* two inner boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT inner box — call data */}
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field label="Phone" value={j?.phone || call.from_number} />
            <Field label="Caller ID" value={call.from_number} />
            <Field label="Service" value={titleize(j?.service_type)} />
            <Field label="Property" value={titleize(j?.property_type)} />
            <div>
              <Field label="Duration" value={fmtDuration(call.duration_sec)} />
              <div className="mt-2">
                <Field
                  label="Cost"
                  value={call.cost != null ? `$${call.cost.toFixed(2)}` : null}
                />
              </div>
            </div>
            <div className="col-span-2">
              <Field label="Address" value={j?.address} />
            </div>
            {j?.notes && (
              <div className="col-span-2">
                <Field label="Notes" value={j.notes} />
              </div>
            )}
          </div>

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

        {/* RIGHT inner box — SMS to forward */}
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-2">
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
    <ul className="space-y-4">
      {calls.map((call) => (
        <CallCard key={call.id} call={call} businessName={businessName} />
      ))}
    </ul>
  );
}
