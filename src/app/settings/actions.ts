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

// Dispatch settings: team SMS + JSON push + caller SMS + email + spam notice.
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
      caller_sms_enabled: formData.get("caller_sms_enabled") === "on",
      caller_link: str("caller_link"),
      caller_link_label: str("caller_link_label"),
      caller_sms_template: str("caller_sms_template"),
      email_enabled: formData.get("email_enabled") === "on",
      email_to: str("email_to"),
      notify_spam: formData.get("notify_spam") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  redirect("/settings?saved=1");
}

// Twilio credentials (API Key). Secret fields are only updated when provided
// (so a blank submit doesn't wipe them). From number always updates.
export async function saveTwilio(formData: FormData) {
  const { supabase, businessId } = await requireAdminBusiness();
  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const sid = str("twilio_account_sid");
  const keySid = str("twilio_api_key_sid");
  const keySecret = str("twilio_api_key_secret");
  const from = str("twilio_number");

  const update: Record<string, unknown> = {
    business_id: businessId,
    twilio_number: from,
    updated_at: new Date().toISOString(),
  };
  if (sid) update.twilio_account_sid = sid;
  if (keySid) update.twilio_api_key_sid = keySid;
  if (keySecret) update.twilio_api_key_secret = keySecret;

  await supabase.from("credentials").upsert(update);
  redirect("/settings?saved=twilio");
}

// Manual only: clear the recording link on calls older than the selected age.
// Keeps the call row, transcript, and job. Runs only when the admin clicks —
// no schedule, no pg_cron.
export async function purgeRecordingsNow(formData: FormData) {
  const { supabase, businessId } = await requireAdminBusiness();
  const days = parseInt(String(formData.get("older_than_days") ?? "90"), 10);
  const clean = [30, 60, 90, 120].includes(days) ? days : 90;
  const cutoff = new Date(Date.now() - clean * 86400000).toISOString();

  const { data } = await supabase
    .from("calls")
    .update({ recording_url: null })
    .eq("business_id", businessId)
    .lt("created_at", cutoff)
    .not("recording_url", "is", null)
    .select("id");

  redirect(`/settings?purged=${data?.length ?? 0}`);
}
