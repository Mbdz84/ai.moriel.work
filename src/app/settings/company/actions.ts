"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";

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
