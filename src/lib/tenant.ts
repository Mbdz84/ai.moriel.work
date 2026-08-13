import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Membership = {
  business_id: string;
  role: string;
  name: string;
  company_id: string;
};

const COOKIE = "active_business";

export function isAdmin(role?: string | null): boolean {
  return role === "owner" || role === "admin" || role === "super";
}

type Row = {
  business_id: string;
  role: string | null;
  businesses: { name: string | null; company_id: string | null } | null;
};

// All companies the logged-in user can access. A super admin sees every
// company; everyone else sees the ones they're a member of.
export async function getMemberships(
  supabase: SupabaseClient
): Promise<Membership[]> {
  const { data: superFlag } = await supabase.rpc("is_super_admin");
  if (superFlag === true) {
    const { data } = await supabase
      .from("businesses")
      .select("id, name, company_id")
      .order("name", { ascending: true });
    return (
      (data ?? []) as { id: string; name: string | null; company_id: string | null }[]
    ).map((b) => ({
      business_id: b.id,
      role: "super",
      name: b.name ?? "",
      company_id: b.company_id ?? "",
    }));
  }

  const { data } = await supabase
    .from("memberships")
    .select("business_id, role, businesses(name, company_id)")
    .order("created_at", { ascending: true });

  return ((data ?? []) as unknown as Row[]).map((m) => ({
    business_id: m.business_id,
    role: m.role ?? "owner",
    name: m.businesses?.name ?? "",
    company_id: m.businesses?.company_id ?? "",
  }));
}

// The active company (from cookie, else the first). Also returns the full
// list so the UI can render a switcher.
export async function getActiveBusiness(supabase: SupabaseClient): Promise<{
  businessId: string | null;
  active: Membership | null;
  memberships: Membership[];
}> {
  const memberships = await getMemberships(supabase);
  if (memberships.length === 0)
    return { businessId: null, active: null, memberships };

  const store = await cookies();
  const wanted = store.get(COOKIE)?.value;
  const active =
    memberships.find((m) => m.business_id === wanted) ?? memberships[0];

  return { businessId: active.business_id, active, memberships };
}
