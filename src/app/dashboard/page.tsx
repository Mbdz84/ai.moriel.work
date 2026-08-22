import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isSuperAdmin } from "@/lib/tenant";
import { computeRange } from "@/lib/date-range";
import AutoRefresh from "@/components/AutoRefresh";
import RangePicker from "@/components/RangePicker";
import CallsView, { type Call } from "@/components/CallsView";

export default async function DashboardPage({
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
  const business = active
    ? { name: active.name, company_id: active.company_id }
    : undefined;

  if (!businessId) {
    return (
      <main className="mx-auto w-full max-w-[1100px] p-8">
        <p className="text-amber-600">
          No company linked to your account.{" "}
          <Link href="/setup" className="underline">
            Finish setup
          </Link>
          .
        </p>
      </main>
    );
  }

  // Disabled account: lock out everyone except platform super admins.
  if (active?.disabled && !(await isSuperAdmin(supabase))) {
    return (
      <main className="mx-auto w-full max-w-[1100px] p-8">
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-6 space-y-2">
          <h1 className="text-xl font-bold text-rose-700">Account disabled</h1>
          <p className="text-sm text-rose-700/90">
            {business?.name ? `${business.name} ` : "This account "}
            has been disabled. Please contact your administrator to restore
            access.
          </p>
        </div>
      </main>
    );
  }

  const range =
    sp.from && sp.to
      ? { start: new Date(sp.from), end: new Date(sp.to) }
      : computeRange(sp.range ?? "this_month");

  const { data: calls } = await supabase
    .from("calls")
    .select(
      "id, from_number, duration_sec, cost, status, ended_reason, recording_url, transcript, created_at, spam, source, jobs(*)"
    )
    .eq("business_id", businessId)
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (calls ?? []) as Call[];

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <AutoRefresh seconds={15} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Calls</h1>
          {business && (
            <p className="text-sm text-neutral-500">
              {business.name} · live activity across your AI receptionist
            </p>
          )}
        </div>
        <RangePicker />
      </div>

      <CallsView calls={rows} businessName={business?.name ?? ""} />
    </main>
  );
}
