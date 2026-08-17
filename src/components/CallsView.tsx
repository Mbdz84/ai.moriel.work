"use client";

import { useMemo, useState } from "react";

export type Job = {
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  property_type: string | null;
  service_type: string | null;
  qualified: boolean | null;
  notes: string | null;
  dispatched_sms: boolean | null;
  dispatched_json: boolean | null;
  details: Record<string, unknown> | null;
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
  spam: boolean | null;
  jobs: Job[];
};

type Filter = "all" | "qualified" | "out_of_scope" | "spam" | "not_texted";

// Detail keys we never surface in the "Collected details" panel.
const HIDDEN_DETAIL_KEYS = new Set([
  "urgency",
  "address_verified",
  "address_validated",
]);

function titleize(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function samePhone(a?: string | null, b?: string | null) {
  const n = (s?: string | null) => (s || "").replace(/\D/g, "").slice(-10);
  return n(a) && n(a) === n(b);
}

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

// Full date + time + timezone abbreviation, e.g. "Aug 17, 2026, 3:45 PM CDT".
// Rendered client-side, so it uses the viewer's local time zone.
function fmtDateTimeTz(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// "2 hr ago" style — hours since the call.
function relTime(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} days ago`;
}

// Split "2123 N 75th Ave, Ellenwood, IL 60707" into street + "city, ST zip".
function splitAddress(addr: string): { street: string; rest: string } {
  const i = addr.indexOf(",");
  if (i === -1) return { street: addr.trim(), rest: "" };
  return { street: addr.slice(0, i).trim(), rest: addr.slice(i + 1).trim() };
}

function callbackOf(call: Call) {
  const j = call.jobs?.[0];
  return isRealPhone(j?.phone) ? j?.phone : call.from_number || j?.phone;
}

function buildSms(businessName: string, call: Call): string {
  const j = call.jobs?.[0];
  return [
    businessName,
    `Name: ${j?.customer_name || "—"}`,
    `Address: ${j?.address || "—"}`,
    `Phone: ${callbackOf(call) || "—"}`,
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
  check,
}: {
  label: string;
  value: string | null | undefined;
  check?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className="text-neutral-800">
        {value || "—"}
        {check && value && (
          <span
            className="text-emerald-600 ml-1"
            title="Address is Google verified"
          >
            ✓
          </span>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, spam }: { name: string; spam?: boolean }) {
  return (
    <div
      className={`flex-none w-9 h-9 rounded-lg grid place-items-center text-sm font-semibold ${
        spam ? "bg-rose-100 text-rose-600" : "bg-indigo-50 text-indigo-600"
      }`}
    >
      {spam ? "!" : initials(name)}
    </div>
  );
}

function StatusBadge({ call }: { call: Call }) {
  const job = call.jobs?.[0];
  const cls =
    "rounded-full text-xs font-medium px-2.5 py-0.5 whitespace-nowrap";
  if (call.spam) {
    return <span className={`${cls} bg-rose-100 text-rose-700`}>Spam</span>;
  }
  if (job?.qualified === false) {
    return <span className={`${cls} bg-amber-100 text-amber-700`}>Out of scope</span>;
  }
  if (job?.qualified === true) {
    return <span className={`${cls} bg-emerald-100 text-emerald-700`}>Qualified</span>;
  }
  return <span className={`${cls} bg-indigo-100 text-indigo-700`}>New</span>;
}

function DeliveryPills({ job }: { job?: Job }) {
  if (!job) return null;
  const pill = "rounded-full px-2 py-0.5 text-[11px] font-medium";
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`${pill} ${
          job.dispatched_sms
            ? "bg-emerald-50 text-emerald-700"
            : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {job.dispatched_sms ? "SMS ✓" : "SMS —"}
      </span>
      {job.dispatched_json && (
        <span className={`${pill} bg-emerald-50 text-emerald-700`}>CRM ✓</span>
      )}
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
  open,
  onToggle,
}: {
  call: Call;
  businessName: string;
  open: boolean;
  onToggle: () => void;
}) {
  const j = call.jobs?.[0];
  const sms = buildSms(businessName, call);
  const [copied, setCopied] = useState(false);

  const name = j?.customer_name || call.from_number || "Unknown caller";
  const service = titleize(j?.service_type);
  const property = titleize(j?.property_type);
  const durCost = `${fmtDuration(call.duration_sec)}${
    call.cost != null ? ` · $${call.cost.toFixed(2)}` : ""
  }`;
  const detailEntries = j?.details
    ? Object.entries(j.details).filter(
        ([k, v]) => v != null && v !== "" && !HIDDEN_DETAIL_KEYS.has(k)
      )
    : [];
  const addrVerified =
    (j?.details as Record<string, unknown> | null)?.address_verified === true;
  const secondNumber =
    j?.phone && isRealPhone(j.phone) && !samePhone(j.phone, call.from_number)
      ? j.phone
      : null;
  const addr = j?.address ? splitAddress(j.address) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(sms);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* ============ DESKTOP: list row ============ */}
      <div
        onClick={onToggle}
        className="hidden md:grid grid-cols-[auto_minmax(9rem,1fr)_2fr_auto_auto_auto] items-center gap-4 px-4 py-3 cursor-pointer hover:bg-neutral-50"
      >
        <Avatar name={name} spam={!!call.spam} />

        {/* Caller — name + up to two numbers */}
        <div className="min-w-0">
          <div className="font-medium truncate">{name}</div>
          <div className="text-sm text-neutral-500 truncate">
            {call.from_number || "—"}
          </div>
          {secondNumber && (
            <div className="text-sm text-neutral-500 truncate">
              {secondNumber}
            </div>
          )}
        </div>

        {/* Job — service, then address on two lines */}
        <div className="min-w-0">
          <div className="font-medium truncate">
            {service || (call.spam ? "Blocked call" : "—")}
          </div>
          {addr ? (
            <>
              <div className="text-sm text-neutral-500 truncate">
                {addr.street}
              </div>
              {addr.rest && (
                <div className="text-sm text-neutral-500 truncate">
                  {addr.rest}
                  {addrVerified && (
                    <span
                      className="text-emerald-600 ml-1"
                      title="Address is Google verified"
                    >
                      ✓
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-neutral-500 truncate">
              {property || (call.spam ? call.ended_reason : "") || "—"}
            </div>
          )}
        </div>

        {/* Date / time */}
        <div
          className="text-right text-sm text-neutral-500 whitespace-nowrap"
          title={fmtDateTimeTz(call.created_at)}
        >
          <div>{fmtTime(call.created_at)}</div>
          <div className="tabular-nums">{durCost}</div>
        </div>

        {/* Relative time + status */}
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-xs text-neutral-400 whitespace-nowrap"
            suppressHydrationWarning
          >
            {relTime(call.created_at)}
          </span>
          <StatusBadge call={call} />
        </div>

        <div className="flex items-center justify-end text-neutral-500">
          <span className="p-1.5">
            <Chevron open={open} />
          </span>
        </div>
      </div>

      {/* ============ MOBILE: card (expand via the Details button only) ============ */}
      <div className="md:hidden p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={name} spam={!!call.spam} />
            <div className="min-w-0">
              <div className="font-medium truncate">{name}</div>
              <div
                className="text-sm text-neutral-500 truncate"
                title={fmtDateTimeTz(call.created_at)}
              >
                {call.from_number || "—"} · {fmtTime(call.created_at)}
              </div>
            </div>
          </div>
          <StatusBadge call={call} />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="col-span-2">
            <Field label="Date / time" value={fmtDateTimeTz(call.created_at)} />
          </div>
          <Field label="Service" value={service} />
          <Field label="Property" value={property} />
          <div className="col-span-2">
            <Field label="Address" value={j?.address} check={addrVerified} />
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
          <DeliveryPills job={j} />
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
          >
            {open ? "Hide" : "Details"}
            <Chevron open={open} />
          </button>
        </div>
      </div>

      {/* ============ SHARED expandable detail ============ */}
      {open && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-4 space-y-4">
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <Field label="Date / time" value={fmtDateTimeTz(call.created_at)} />
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
              <Field label="Address" value={j?.address} check={addrVerified} />
            </div>
            {j?.notes && (
              <div className="col-span-2 lg:col-span-3">
                <Field label="Notes" value={j.notes} />
              </div>
            )}
          </div>

          {/* Extra details the agent collected */}
          {detailEntries.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
                Collected details
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {detailEntries.map(([k, v]) => (
                  <Field key={k} label={titleize(k)} value={String(v)} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span>
                  {call.status}
                  {call.ended_reason ? ` · ${call.ended_reason}` : ""}
                </span>
                <DeliveryPills job={j} />
              </div>
              <button
                onClick={copy}
                title={sms}
                className="rounded-lg bg-black text-white text-sm px-3 py-1.5 whitespace-nowrap"
              >
                {copied ? "Copied!" : "Copy as SMS"}
              </button>
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
        </div>
      )}
    </li>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-neutral-800"}`}>
        {value}
      </div>
    </div>
  );
}

function toCsv(calls: Call[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "When",
    "Caller",
    "Callback",
    "Name",
    "Service",
    "Property",
    "Address",
    "Duration (s)",
    "Cost",
    "Status",
    "Spam",
    "Notes",
  ];
  const rows = calls.map((c) => {
    const j = c.jobs?.[0];
    const status = c.spam
      ? "Spam"
      : j?.qualified === false
      ? "Out of scope"
      : j
      ? "Qualified"
      : "New";
    return [
      new Date(c.created_at).toISOString(),
      c.from_number ?? "",
      callbackOf(c) ?? "",
      j?.customer_name ?? "",
      titleize(j?.service_type),
      titleize(j?.property_type),
      j?.address ?? "",
      c.duration_sec ?? "",
      c.cost ?? "",
      status,
      c.spam ? "yes" : "",
      j?.notes ?? "",
    ]
      .map(esc)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export default function CallsView({
  calls,
  businessName,
}: {
  calls: Call[];
  businessName: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const kpis = useMemo(() => {
    const uniq = new Set(
      calls
        .map((c) => (c.from_number || "").replace(/\D/g, "").slice(-10))
        .filter(Boolean)
    );
    const withDur = calls.filter((c) => c.duration_sec);
    const avg = withDur.length
      ? Math.round(
          withDur.reduce((t, c) => t + (c.duration_sec ?? 0), 0) / withDur.length
        )
      : 0;
    return {
      total: calls.length,
      jobs: calls.filter((c) => !c.spam && c.jobs?.length > 0).length,
      unique: uniq.size,
      avg: fmtDuration(avg || null),
      spam: calls.filter((c) => c.spam).length,
    };
  }, [calls]);

  const counts = useMemo(() => {
    const c = { all: calls.length, qualified: 0, out_of_scope: 0, spam: 0, not_texted: 0 };
    for (const call of calls) {
      const j = call.jobs?.[0];
      if (call.spam) c.spam++;
      else if (j?.qualified === false) c.out_of_scope++;
      else if (j) c.qualified++;
      if (j && !j.dispatched_sms && !call.spam) c.not_texted++;
    }
    return c;
  }, [calls]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return calls.filter((call) => {
      const j = call.jobs?.[0];
      if (filter === "qualified" && !(!call.spam && j && j.qualified !== false))
        return false;
      if (filter === "out_of_scope" && !(j && j.qualified === false)) return false;
      if (filter === "spam" && !call.spam) return false;
      if (filter === "not_texted" && !(j && !j.dispatched_sms && !call.spam))
        return false;
      if (!needle) return true;
      const hay = [
        j?.customer_name,
        call.from_number,
        j?.phone,
        titleize(j?.service_type),
        titleize(j?.property_type),
        j?.address,
        j?.notes,
        fmtTime(call.created_at),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [calls, q, filter]);

  const allOpen =
    filtered.length > 0 && filtered.every((c) => openIds.has(c.id));

  function expandAll() {
    setOpenIds(new Set(filtered.map((c) => c.id)));
  }
  function collapseAll() {
    setOpenIds(new Set());
  }

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calls.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "qualified", label: "Qualified", count: counts.qualified },
    { key: "out_of_scope", label: "Out of scope", count: counts.out_of_scope },
    { key: "not_texted", label: "Not texted", count: counts.not_texted },
    { key: "spam", label: "Spam", count: counts.spam },
  ];

  const ghostBtn =
    "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 whitespace-nowrap";

  return (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="Calls" value={kpis.total} />
        <Kpi label="Jobs captured" value={kpis.jobs} accent="text-emerald-600" />
        <Kpi label="Unique callers" value={kpis.unique} />
        <Kpi label="Avg. duration" value={kpis.avg} />
        <Kpi label="Spam" value={kpis.spam} accent="text-rose-600" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, service, address, notes…"
            className="w-full rounded-lg border border-neutral-300 bg-white pl-3 pr-8 py-2 text-sm"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              ×
            </button>
          )}
        </div>
        <button onClick={exportCsv} className={ghostBtn}>
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${
              filter === c.key
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            {c.label}
            <span className={filter === c.key ? "opacity-80" : "text-neutral-400"}>
              {" "}
              {c.count}
            </span>
          </button>
        ))}
        {filtered.length > 0 && (
          <button
            onClick={allOpen ? collapseAll : expandAll}
            className={`${ghostBtn} ml-auto`}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {/* List */}
      {calls.length === 0 ? (
        <p className="text-neutral-500">
          No calls yet. When your Vapi number takes a call, it will appear here.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-neutral-500">No calls match your search or filter.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              businessName={businessName}
              open={openIds.has(call.id)}
              onToggle={() => toggle(call.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
