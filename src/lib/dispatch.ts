import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms } from "./twilio";
import {
  DEFAULT_SMS_TEMPLATE,
  DEFAULT_CALLER_SMS_TEMPLATE,
  renderSmsTemplate,
  titleize,
} from "./sms-template";
import { buildJobSummary } from "./job-summary";
import { emailConfigured, sendEmail } from "./email";

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
  caller_sms_enabled: boolean | null;
  caller_link: string | null;
  caller_link_label: string | null;
  caller_sms_template: string | null;
  email_enabled: boolean | null;
  email_to: string | null;
  notify_spam: boolean | null;
};

type Credentials = {
  twilio_account_sid: string | null;
  twilio_api_key_sid: string | null;
  twilio_api_key_secret: string | null;
  twilio_auth_token: string | null;
  twilio_number: string | null;
};

// Extra per-call context the dispatcher can't recompute on its own.
type DispatchOptions = {
  // Two-line, validated address to show in the SMS (from Google validation).
  smsAddress?: string | null;
  // Call metadata, used for the email summary.
  call?: {
    recordingUrl?: string | null;
    transcript?: string | null;
    durationSec?: number | null;
    endedReason?: string | null;
    fromNumber?: string | null;
  };
};

function splitList(raw?: string | null): string[] {
  return (raw || "")
    .split(/[,\n;]+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

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
  agentName: string,
  data: JobData,
  callerNumber?: string | null,
  opts?: DispatchOptions
): string {
  return renderSmsTemplate(template, {
    business: businessName,
    agent: agentName,
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

function buildEmailSummary(
  businessName: string,
  data: JobData,
  callerNumber?: string | null,
  opts?: DispatchOptions
): { subject: string; text: string } {
  const summary = buildJobSummary(data) || "New call";
  const phone = resolveCallbackPhone(data.phone, callerNumber);
  const dur = opts?.call?.durationSec;
  const lines = [
    `New call for ${businessName || "your business"}`,
    "",
    `Job: ${summary}`,
    data.name ? `Name: ${data.name}` : "",
    phone ? `Phone: ${phone}` : "",
    (opts?.smsAddress || data.address) ? `Address: ${opts?.smsAddress || data.address}` : "",
    data.service_type ? `Service: ${titleize(data.service_type)}` : "",
    data.qualified === false ? "Flagged: out of scope" : "",
    callerNumber ? `Caller ID: ${callerNumber}` : "",
    typeof dur === "number" ? `Duration: ${dur}s` : "",
    data.notes ? `\nNotes:\n${data.notes}` : "",
    opts?.call?.recordingUrl ? `\nRecording: ${opts.call.recordingUrl}` : "",
    opts?.call?.transcript ? `\nTranscript:\n${opts.call.transcript}` : "",
  ].filter(Boolean);
  return { subject: `New job — ${summary}`, text: lines.join("\n") };
}

// Sends the SMS + optional JSON push + optional caller SMS + optional email
// for a captured job. Reads dispatch_targets/credentials for the business;
// falls back to env for the SMS destination so a single-business setup works.
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

  const { data: agent } = (await supabase
    .from("agents")
    .select("display_name")
    .eq("business_id", businessId)
    .maybeSingle()) as { data: { display_name: string | null } | null };

  const businessName = biz?.name ?? "";
  const agentName = agent?.display_name ?? "";

  const creds = {
    accountSid: cred?.twilio_account_sid,
    keySid: cred?.twilio_api_key_sid,
    keySecret: cred?.twilio_api_key_secret,
    authToken: cred?.twilio_auth_token,
    from: cred?.twilio_number,
  };

  // ---- Team SMS (one or more recipients) ----
  const template =
    (target?.sms_template && target.sms_template.trim()) || DEFAULT_SMS_TEMPLATE;
  const body = buildJobMessage(
    template,
    businessName,
    agentName,
    data,
    callerNumber,
    opts
  );
  const numbers = splitList(target?.sms_to || process.env.DISPATCH_SMS_TO);
  const smsEnabled = target ? target.sms_enabled !== false : true;
  if (smsEnabled && numbers.length > 0) {
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

  // ---- Caller SMS (to the caller, with a helpful link) ----
  if (
    target?.caller_sms_enabled &&
    callerNumber &&
    (target.caller_link || "").trim()
  ) {
    const callerTemplate =
      (target.caller_sms_template && target.caller_sms_template.trim()) ||
      DEFAULT_CALLER_SMS_TEMPLATE;
    const callerBody = renderSmsTemplate(callerTemplate, {
      business: businessName,
      agent: agentName,
      name: data.name ?? "",
      link: target.caller_link ?? "",
      link_label: target.caller_link_label || "Link",
    });
    try {
      await sendSms(callerNumber, callerBody, creds);
    } catch (e) {
      console.error("Caller SMS failed:", e);
    }
  }

  // ---- Email summary ----
  const emailTo = splitList(target?.email_to);
  if (target?.email_enabled && emailConfigured() && emailTo.length > 0) {
    const { subject, text } = buildEmailSummary(
      businessName,
      data,
      callerNumber,
      opts
    );
    try {
      await sendEmail({ to: emailTo, subject, text });
    } catch (e) {
      console.error("Email summary failed:", e);
    }
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

// Notify the team about a spam / no-intent call, only when notify_spam is on.
export async function notifySpamCall(
  supabase: SupabaseClient,
  businessId: string,
  info: { fromNumber?: string | null; durationSec?: number | null; endedReason?: string | null }
) {
  const { data: target } = (await supabase
    .from("dispatch_targets")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle()) as { data: DispatchTarget | null };
  if (!target?.notify_spam) return;

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

  const from = info.fromNumber || "unknown number";
  const dur = typeof info.durationSec === "number" ? ` (${info.durationSec}s)` : "";
  const body = `${biz?.name ?? "Front desk"}: spam/unknown call from ${from}${dur}. No job captured.`;

  const numbers = splitList(target.sms_to || process.env.DISPATCH_SMS_TO);
  if (numbers.length > 0) {
    const creds = {
      accountSid: cred?.twilio_account_sid,
      keySid: cred?.twilio_api_key_sid,
      keySecret: cred?.twilio_api_key_secret,
      authToken: cred?.twilio_auth_token,
      from: cred?.twilio_number,
    };
    for (const n of numbers) {
      try {
        await sendSms(n, body, creds);
      } catch (e) {
        console.error(`Spam notice to ${n} failed:`, e);
      }
    }
  }

  const emailTo = splitList(target.email_to);
  if (target.email_enabled && emailConfigured() && emailTo.length > 0) {
    try {
      await sendEmail({ to: emailTo, subject: "Spam / unknown call", text: body });
    } catch (e) {
      console.error("Spam email failed:", e);
    }
  }
}
