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

  return <NavBar admin={admin} active={active} memberships={memberships} />;
}
