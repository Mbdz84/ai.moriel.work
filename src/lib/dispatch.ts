import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "./twilio";

// Shape of the extracted job data (mirrors the Vapi structured output).
export type JobData = {
  name?: string;
  phone?: string;
  address?: string;
  property_type?: string;
  service_type?: string;
  urgency?: string;
  qualified?: boolean;
  notes?: string;
};

type DispatchTarget = {
  sms_enabled: boolean | null;
  sms_to: string | null;
  json_enabled: boolean | null;
  json_url: string | null;
  json_headers: Record<string, string> | null;
};

function formatJobMessage(data: JobData): string {
  const lines = [
    "New locksmith job",
    data.name ? `Name: ${data.name}` : null,
    data.phone ? `Phone: ${data.phone}` : null,
    data.address ? `Address: ${data.address}` : null,
    data.service_type
      ? `Service: ${data.service_type}${data.property_type ? ` (${data.property_type})` : ""}`
      : null,
    data.urgency ? `Urgency: ${data.urgency}` : null,
    data.notes ? `Notes: ${data.notes}` : null,
    data.qualified === false ? "(Flagged: out of scope)" : null,
  ].filter(Boolean);
  return lines.join("\n");
}

// Sends the SMS + optional JSON push for a captured job.
// Reads dispatch_targets for the business; falls back to env for the SMS
// destination so a single-business setup works without a DB row.
export async function dispatchJob(
  supabase: SupabaseClient,
  businessId: string,
  jobId: string,
  data: JobData
) {
  const { data: target } = (await supabase
    .from("dispatch_targets")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle()) as { data: DispatchTarget | null };

  const body = formatJobMessage(data);

  // ---- SMS ----
  const smsTo = target?.sms_to || process.env.DISPATCH_SMS_TO || "";
  const smsEnabled = target ? target.sms_enabled !== false : true;
  if (smsEnabled && smsTo) {
    try {
      await sendSms(smsTo, body);
      await supabase.from("jobs").update({ dispatched_sms: true }).eq("id", jobId);
    } catch (e) {
      console.error("SMS dispatch failed:", e);
    }
  } else {
    console.warn("SMS skipped: no destination number configured");
  }

  // ---- Custom JSON push ----
  if (target?.json_enabled && target?.json_url) {
    try {
      await fetch(target.json_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(target.json_headers ?? {}),
        },
        body: JSON.stringify({ businessId, jobId, ...data }),
      });
      await supabase.from("jobs").update({ dispatched_json: true }).eq("id", jobId);
    } catch (e) {
      console.error("JSON dispatch failed:", e);
    }
  }
}
