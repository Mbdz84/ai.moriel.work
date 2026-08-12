import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Load the tenant this user belongs to (RLS scopes to their membership).
  const { data: membership } = await supabase
    .from("memberships")
    .select("business_id, role, businesses(name, company_id)")
    .maybeSingle();

  const business = membership?.businesses as
    | { name: string; company_id: string }
    | undefined;

  return (
    <main className="mx-auto max-w-5xl p-8 space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {business ? (
        <p className="text-neutral-600">
          {business.name} · Company ID {business.company_id}
        </p>
      ) : (
        <p className="text-amber-600">
          No company linked to your account yet.{" "}
          <Link href="/signup" className="underline">
            Finish setup
          </Link>
          .
        </p>
      )}

      <p className="text-neutral-500">
        Incoming calls, collected info, and recordings will show here (next).
      </p>
    </main>
  );
}
