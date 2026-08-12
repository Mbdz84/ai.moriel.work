import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";
import AutoRefresh from "@/components/AutoRefresh";

type Job = {
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

type Call = {
  id: string;
  from_number: string | null;
  duration_sec: number | null;
  status: string | null;
  ended_reason: string | null;
  recording_url: string | null;
  transcript: string | null;
  created_at: string;
  jobs: Job[];
};

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("business_id, businesses(name, company_id)")
    .maybeSingle();
  const business = membership?.businesses as
    | { name: string; company_id: string }
    | undefined;
  if (!membership?.business_id) {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <p className="text-amber-600">
          No company linked to your account.{" "}
          <Link href="/signup" className="underline">
            Finish setup
          </Link>
          .
        </p>
      </main>
    );
  }

  const { data: calls } = await supabase
    .from("calls")
    .select(
      "id, from_number, duration_sec, status, ended_reason, recording_url, transcript, created_at, jobs(*)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (calls ?? []) as Call[];

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <AutoRefresh seconds={15} />

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calls</h1>
          {business && (
            <p className="text-sm text-neutral-500">
              {business.name} · {rows.length} recent
            </p>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-neutral-500">
          No calls yet. When your Vapi number takes a call, it will appear here.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((call) => {
            const job = call.jobs?.[0];
            return (
              <li
                key={call.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {job?.customer_name || call.from_number || "Unknown caller"}
                    </span>
                    {job?.urgency === "emergency" && (
                      <span className="rounded bg-red-100 text-red-700 text-xs px-2 py-0.5">
                        emergency
                      </span>
                    )}
                    {job?.qualified === false && (
                      <span className="rounded bg-amber-100 text-amber-700 text-xs px-2 py-0.5">
                        out of scope
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-neutral-400">
                    {fmtTime(call.created_at)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                  <Field label="Phone" value={job?.phone || call.from_number} />
                  <Field label="Service" value={job?.service_type} />
                  <Field label="Property" value={job?.property_type} />
                  <Field label="Duration" value={fmtDuration(call.duration_sec)} />
                  <div className="col-span-2 sm:col-span-4">
                    <Field label="Address" value={job?.address} />
                  </div>
                  {job?.notes && (
                    <div className="col-span-2 sm:col-span-4">
                      <Field label="Notes" value={job.notes} />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span>
                    {call.status}
                    {call.ended_reason ? ` · ${call.ended_reason}` : ""}
                  </span>
                  {job?.dispatched_sms && <span>✓ SMS sent</span>}
                </div>

                {call.recording_url && (
                  <audio controls preload="none" className="w-full">
                    <source src={call.recording_url} />
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
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
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
