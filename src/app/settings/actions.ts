"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness } from "@/lib/tenant";

// Saves Twilio credentials + dispatch settings for the active tenant.
// RLS ensures a user can only write their own business's rows.
export async function saveSettings(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");

  const str = (k: string) => String(formData.get(k) ?? "").trim();

  await supabase.from("credentials").upsert({
    business_id: businessId,
    twilio_account_sid: str("twilio_account_sid"),
    twilio_auth_token: str("twilio_auth_token"),
    twilio_number: str("twilio_number"),
    updated_at: new Date().toISOString(),
  });

  await supabase
    .from("dispatch_targets")
    .update({
      sms_enabled: formData.get("sms_enabled") === "on",
      sms_to: str("sms_to"),
      json_enabled: formData.get("json_enabled") === "on",
      json_url: str("json_url"),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  redirect("/settings?saved=1");
}
