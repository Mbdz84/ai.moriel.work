"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveBusiness, isAdmin, isSuperAdmin } from "@/lib/tenant";

async function requireAdmin() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId || !isAdmin(active?.role)) redirect("/dashboard");
  return { supabase, businessId, userId: user.id };
}

// Stricter gate for account-level destructive actions: platform super admin.
async function requireSuper() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { businessId } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!(await isSuperAdmin(supabase))) redirect("/settings/company");
  return { supabase, businessId, userId: user.id };
}

export async function updateCompany(formData: FormData) {
  const { supabase, businessId } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();

  const { error } = await supabase
    .from("businesses")
    .update({ name, company_id: companyId })
    .eq("id", businessId);

  redirect(
    `/settings/company?saved=${error ? "err" : "1"}${
      error ? `&msg=${encodeURIComponent(error.message)}` : ""
    }`
  );
}

export async function addUser(formData: FormData) {
  const { businessId } = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "viewer");

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    redirect(
      `/settings/company?saved=err&msg=${encodeURIComponent(
        error?.message ?? "could not create user"
      )}`
    );
  }

  const { error: memErr } = await admin.from("memberships").insert({
    business_id: businessId,
    user_id: data.user.id,
    role: role === "admin" ? "admin" : "viewer",
  });

  redirect(
    `/settings/company?saved=${memErr ? "err" : "user"}${
      memErr ? `&msg=${encodeURIComponent(memErr.message)}` : ""
    }`
  );
}

export async function removeUser(formData: FormData) {
  const { businessId, userId } = await requireAdmin();
  const target = String(formData.get("user_id") ?? "");

  // Don't let an admin remove themselves here.
  if (target && target !== userId) {
    const admin = createSupabaseAdmin();
    await admin
      .from("memberships")
      .delete()
      .eq("business_id", businessId)
      .eq("user_id", target);
  }
  redirect("/settings/company?saved=removed");
}

// ---- Super-admin: disable / re-enable / delete the active company ----

export async function disableAccount() {
  const { businessId } = await requireSuper();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("businesses")
    .update({ disabled: true, disabled_at: new Date().toISOString() })
    .eq("id", businessId);
  redirect(
    `/settings/company?saved=${error ? "err" : "disabled"}${
      error ? `&msg=${encodeURIComponent(error.message)}` : ""
    }`
  );
}

export async function enableAccount() {
  const { businessId } = await requireSuper();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("businesses")
    .update({ disabled: false, disabled_at: null })
    .eq("id", businessId);
  redirect(
    `/settings/company?saved=${error ? "err" : "enabled"}${
      error ? `&msg=${encodeURIComponent(error.message)}` : ""
    }`
  );
}

export async function deleteAccount(formData: FormData) {
  const { businessId } = await requireSuper();
  const confirmName = String(formData.get("confirm_name") ?? "").trim();

  const admin = createSupabaseAdmin();
  const { data: biz } = await admin
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  const name = (biz?.name as string | null)?.trim() ?? "";

  // Re-validate the type-to-confirm server-side.
  if (!name || confirmName !== name) {
    redirect(
      `/settings/company?saved=err&msg=${encodeURIComponent(
        "Confirmation name did not match. Nothing was deleted."
      )}`
    );
  }

  // Cascade removes calls, jobs, sources, dispatch_targets, credentials,
  // agents, and memberships. Login users are left intact.
  const { error } = await admin.from("businesses").delete().eq("id", businessId);
  if (error) {
    redirect(
      `/settings/company?saved=err&msg=${encodeURIComponent(error.message)}`
    );
  }

  // Clear the active-company cookie so the next page re-scopes cleanly.
  const store = await cookies();
  store.delete("active_business");
  redirect("/dashboard");
}
