import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";

type Row = {
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

export default async function UsagePage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  // Exact all-time count.
  const { count: allCount } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId);

  // Recent rows for cost + this-month math.
  const { data } = await supabase
    .from("calls")
    .select("cost, duration_sec, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = (data ?? []) as Row[];
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const monthRows = rows.filter((r) => new Date(r.created_at) >= start);
  const sum = (rs: Row[]) => rs.reduce((t, r) => t + (r.cost ?? 0), 0);

  const monthCalls = monthRows.length;
  const monthCost = sum(monthRows);
  const allCost = sum(rows);
  const capped = (allCount ?? 0) > rows.length;

  const card = "rounded-lg border border-neutral-200 bg-white p-4";

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usage</h1>
        <SettingsNav active="usage" admin={true} />
      </div>
      {active && (
        <p className="text-sm text-neutral-500">
          {active.name} · {active.company_id}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-neutral-400">
            This month
          </div>
          <div className="mt-1 text-2xl font-bold">{usd(monthCost)}</div>
          <div className="text-sm text-neutral-500">{monthCalls} calls</div>
        </div>
        <div className={card}>
          <div className="text-xs uppercase tracking-wide text-neutral-400">
            All time
          </div>
          <div className="mt-1 text-2xl font-bold">{usd(allCost)}</div>
          <div className="text-sm text-neutral-500">
            {allCount ?? 0} calls
            {capped && " (cost from last 1000)"}
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        Cost is the raw Vapi usage per call. Add your markup when billing clients.
      </p>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent calls</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-400 border-b border-neutral-200">
              <th className="py-2 font-medium">When</th>
              <th className="py-2 font-medium">Duration</th>
              <th className="py-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((r, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2">{fmtTime(r.created_at)}</td>
                <td className="py-2">{mins(r.duration_sec)}</td>
                <td className="py-2 text-right">
                  {r.cost != null ? usd(r.cost) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-neutral-500">
                  No calls yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
