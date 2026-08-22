import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import NavBar from "@/components/NavBar";

export default async function TopBar() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { active, memberships } = await getActiveBusiness(supabase);
  const admin = isAdmin(active?.role);

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const userName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email ||
    "Account";

  return (
    <NavBar
      admin={admin}
      active={active}
      memberships={memberships}
      userName={userName}
    />
  );
}
