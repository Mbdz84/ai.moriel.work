"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";

// Save the per-business SMS template (how the job text is formatted).
export async function saveSmsTemplate(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId || !isAdmin(active?.role)) redirect("/dashboard");

  const template = String(formData.get("sms_template") ?? "").trim();

  await supabase
    .from("dispatch_targets")
    .update({ sms_template: template, updated_at: new Date().toISOString() })
    .eq("business_id", businessId);

  redirect("/settings/sms?saved=1");
}
