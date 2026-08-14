"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";

async function requireAdminBusiness() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId || !isAdmin(active?.role)) redirect("/dashboard");
  return { supabase, businessId };
}

// Dispatch settings (SMS recipients + JSON push). Multiple SMS numbers
// are joined into a comma-separated string.
export async function saveSettings(formData: FormData) {
  const { supabase, businessId } = await requireAdminBusiness();
  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const numbers = formData
    .getAll("sms_to")
    .map((v) => String(v).trim())
    .filter(Boolean);

  await supabase
    .from("dispatch_targets")
    .update({
      sms_enabled: formData.get("sms_enabled") === "on",
      sms_to: numbers.join(", "),
      json_enabled: formData.get("json_enabled") === "on",
      json_url: str("json_url"),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  redirect("/settings?saved=1");
}

// Twilio credentials. SID/token are only updated when provided (so the
// masked values aren't wiped by a blank submit). From number always updates.
export async function saveTwilio(formData: FormData) {
  const { supabase, businessId } = await requireAdminBusiness();
  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const sid = str("twilio_account_sid");
  const token = str("twilio_auth_token");
  const from = str("twilio_number");

  const update: Record<string, unknown> = {
    business_id: businessId,
    twilio_number: from,
    updated_at: new Date().toISOString(),
  };
  if (sid) update.twilio_account_sid = sid;
  if (token) update.twilio_auth_token = token;

  await supabase.from("credentials").upsert(update);
  redirect("/settings?saved=twilio");
}
