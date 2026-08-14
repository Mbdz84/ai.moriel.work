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

type Credentials = {
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_number: string | null;
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

  const { data: cred } = (await supabase
    .from("credentials")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle()) as { data: Credentials | null };

  const body = formatJobMessage(data);

  // ---- SMS (one or more recipients) ----
  const raw = target?.sms_to || process.env.DISPATCH_SMS_TO || "";
  const numbers = raw
    .split(/[,\n;]+/)
    .map((n) => n.trim())
    .filter(Boolean);
  const smsEnabled = target ? target.sms_enabled !== false : true;
  if (smsEnabled && numbers.length > 0) {
    const creds = {
      sid: cred?.twilio_account_sid,
      token: cred?.twilio_auth_token,
      from: cred?.twilio_number,
    };
    let anySent = false;
    for (const n of numbers) {
      try {
        await sendSms(n, body, creds);
        anySent = true;
      } catch (e) {
        console.error(`SMS to ${n} failed:`, e);
      }
    }
    if (anySent) {
      await supabase.from("jobs").update({ dispatched_sms: true }).eq("id", jobId);
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
