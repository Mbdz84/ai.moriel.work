import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";
import LogoutButton from "@/components/LogoutButton";

// Shown on every page. Renders the nav only when a user is logged in,
// so /login and /signup stay clean.
export default async function TopBar() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("businesses(name, company_id)")
    .maybeSingle();
  const business = membership?.businesses as
    | { name: string; company_id: string }
    | undefined;

  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto max-w-5xl flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold">
            Voice-AI
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-neutral-600 hover:text-black">
              Dashboard
            </Link>
            <Link href="/settings" className="text-neutral-600 hover:text-black">
              Settings
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {business && (
            <span className="text-neutral-500 hidden sm:inline">
              {business.name} · {business.company_id}
            </span>
          )}
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
