import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";
import AccountForm from "@/components/AccountForm";

// Accessible to ALL users (including viewers) so anyone can change their
// own password/email.
export default async function AccountSettingsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { active } = await getActiveBusiness(supabase);
  const admin = isAdmin(active?.role);

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account</h1>
        <SettingsNav active="account" admin={admin} />
      </div>
      <p className="text-sm text-neutral-500">{user.email}</p>
      <div className="max-w-md">
        <AccountForm />
      </div>
    </main>
  );
}
