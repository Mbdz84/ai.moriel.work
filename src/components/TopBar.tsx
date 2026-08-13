import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import LogoutButton from "@/components/LogoutButton";
import CompanySwitcher from "@/components/CompanySwitcher";

export default async function TopBar() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { active, memberships } = await getActiveBusiness(supabase);
  const admin = isAdmin(active?.role);

  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto max-w-[1100px] flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold">
            Voice-AI
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-neutral-600 hover:text-black">
              Dashboard
            </Link>
            {admin ? (
              <Link
                href="/settings"
                className="text-neutral-600 hover:text-black"
              >
                Settings
              </Link>
            ) : (
              <Link
                href="/settings/account"
                className="text-neutral-600 hover:text-black"
              >
                Account
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {active?.role === "super" && (
            <span className="rounded bg-red-600 text-white text-xs px-2 py-0.5">
              SUPER
            </span>
          )}
          {active && (
            <CompanySwitcher
              memberships={memberships}
              activeId={active.business_id}
            />
          )}
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
