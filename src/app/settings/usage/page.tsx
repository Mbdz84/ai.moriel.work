import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { computeRange } from "@/lib/date-range";
import SettingsNav from "@/components/SettingsNav";
import RangePicker from "@/components/RangePicker";

type Row = {
  from_number: string | null;
  cost: number | null;
  duration_sec: number | null;
  created_at: string;
};

function usd(n: number) {
  return `$${n.toFixed(2)}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function mins(s: number | null) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  const range =
    sp.from && sp.to
      ? { start: new Date(sp.from), end: new Date(sp.to) }
      : computeRange(sp.range ?? "this_month");

  const { data } = await supabase
    .from("calls")
    .select("from_number, cost, duration_sec, created_at")
    .eq("business_id", businessId)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = (data ?? []) as Row[];
  const calls = rows.length;
  const cost = rows.reduce((t, r) => t + (r.cost ?? 0), 0);
  const totalSec = rows.reduce((t, r) => t + (r.duration_sec ?? 0), 0);

  const card = "rounded-lg border border-neutral-200 bg-white p-4";

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usage</h1>
        <SettingsNav active="usage" admin={true} />
      </div>

      <div className="flex items-center justify-between">
        {active && (
          <p className="text-sm text-neutral-500">
            {active.name} · {active.company_id}
          </p>
        )}
        <RangePicker />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-neutral-400">
            Calls
          </div>
          <div className="mt-1 text-2xl font-bold">{calls}</div>
        </div>
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-neutral-400">
            Cost
          </div>
          <div className="mt-1 text-2xl font-bold">{usd(cost)}</div>
        </div>
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-neutral-400">
            Talk time
          </div>
          <div className="mt-1 text-2xl font-bold">
            {Math.round(totalSec / 60)}m
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        Cost is the raw Vapi usage per call. Add your markup when billing clients.
      </p>

      <section className="space-y-2">
        <h2 className="font-semibold">Calls in range</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-neutral-400 border-b border-neutral-200">
              <th className="py-2 font-medium">When</th>
              <th className="py-2 font-medium">Caller</th>
              <th className="py-2 font-medium">Duration</th>
              <th className="py-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2">{fmtTime(r.created_at)}</td>
                <td className="py-2">{r.from_number || "—"}</td>
                <td className="py-2">{mins(r.duration_sec)}</td>
                <td className="py-2 text-right">
                  {r.cost != null ? usd(r.cost) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-neutral-500">
                  No calls in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
