import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness } from "@/lib/tenant";
import AutoRefresh from "@/components/AutoRefresh";
import CallsView, { type Call } from "@/components/CallsView";

export default async function DashboardPage() {
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
      <main className="mx-auto max-w-6xl p-8">
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

  const { data: calls } = await supabase
    .from("calls")
    .select(
      "id, from_number, duration_sec, cost, status, ended_reason, recording_url, transcript, created_at, jobs(*)"
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (calls ?? []) as Call[];

  return (
    <main className="mx-auto max-w-6xl p-8 space-y-6">
      <AutoRefresh seconds={15} />

      <div>
        <h1 className="text-2xl font-bold">Calls</h1>
        {business && (
          <p className="text-sm text-neutral-500">
            {business.name} · {rows.length} recent
          </p>
        )}
      </div>

      <CallsView calls={rows} businessName={business?.name ?? ""} />
    </main>
  );
}
