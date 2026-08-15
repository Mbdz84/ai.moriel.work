import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "./twilio";
import {
  DEFAULT_SMS_TEMPLATE,
  renderSmsTemplate,
  titleize,
} from "./sms-template";
import { buildJobSummary } from "./job-summary";

// Shape of the extracted job data (mirrors the Vapi structured output).
export type JobData = {
  name?: string;
  phone?: string;
  address?: string;
  property_type?: string;
  service_type?: string;
  vehicle?: string; // optional structured vehicle; falls back to parsing notes
  qualified?: boolean;
  notes?: string;
};

type DispatchTarget = {
  sms_enabled: boolean | null;
  sms_to: string | null;
  sms_template: string | null;
  json_enabled: boolean | null;
  json_url: string | null;
  json_headers: Record<string, string> | null;
};

type Credentials = {
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_number: string | null;
};

// Extra per-call overrides for the SMS body (values dispatch can't recompute).
type DispatchOptions = {
  // Two-line, validated address to show in the SMS (from Google validation).
  smsAddress?: string | null;
};

// A value counts as a real phone number only if it carries enough digits.
// Guards against the agent capturing things like "same number" as the phone.
export function looksLikePhone(s?: string | null): boolean {
  return !!s && s.replace(/\D/g, "").length >= 7;
}

// Resolve the best callback number: the collected phone when it's a real
// number, otherwise the caller ID (used when the caller says "same number").
export function resolveCallbackPhone(
  phone?: string | null,
  callerNumber?: string | null
): string {
  if (looksLikePhone(phone)) return phone as string;
  return callerNumber || phone || "";
}

function buildJobMessage(
  template: string,
  businessName: string,
  data: JobData,
  callerNumber?: string | null,
  opts?: DispatchOptions
): string {
  return renderSmsTemplate(template, {
    business: businessName,
    name: data.name ?? "",
    phone: resolveCallbackPhone(data.phone, callerNumber),
    caller_id: callerNumber ?? "",
    address: opts?.smsAddress || data.address || "",
    summary: buildJobSummary(data),
    service: titleize(data.service_type),
    property: titleize(data.property_type),
    notes: data.notes ?? "",
    flag: data.qualified === false ? "(Flagged: out of scope)" : "",
  });
}

// Sends the SMS + optional JSON push for a captured job.
// Reads dispatch_targets for the business; falls back to env for the SMS
// destination so a single-business setup works without a DB row.
export async function dispatchJob(
  supabase: SupabaseClient,
  businessId: string,
  jobId: string,
  data: JobData,
  callerNumber?: string | null,
  opts?: DispatchOptions
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

  const { data: biz } = (await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle()) as { data: { name: string | null } | null };

  const template =
    (target?.sms_template && target.sms_template.trim()) || DEFAULT_SMS_TEMPLATE;
  const body = buildJobMessage(
    template,
    biz?.name ?? "",
    data,
    callerNumber,
    opts
  );

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
