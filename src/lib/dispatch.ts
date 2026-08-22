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

// Per-source routing config resolved from the call's assistant.
export type SourceContext = {
  // Display label / brand this source represents ({source} token).
  label?: string | null;
  // Outbound number this source texts from (overrides the account default).
  fromNumber?: string | null;
  // The {agent} name this source signs texts with.
  agentName?: string | null;
  // Extra job-SMS recipients, layered on top of the global list.
  extraSmsTo?: string | null;
  // Extra CRM / JSON webhook, in addition to the global one.
  extraJsonUrl?: string | null;
  // When true, skip the global Team dispatch destinations and use only
  // this source's own extras.
  excludeFromGlobal?: boolean | null;
  // Notify the team about spam / no-intent calls for this source.
  notifySpam?: boolean | null;
  // Text the caller a link after the call (per source).
  callerSmsEnabled?: boolean | null;
  callerLink?: string | null;
  callerLinkLabel?: string | null;
  callerSmsTemplate?: string | null;
};

// Extra per-call context the dispatcher can't recompute on its own.
type DispatchOptions = {
  // Two-line, validated address to show in the SMS (from Google validation).
  smsAddress?: string | null;
  // Per-source routing config for this call.
  source?: SourceContext | null;
  // Call metadata, used for the email summary.
  call?: {
    recordingUrl?: string | null;
    transcript?: string | null;
    durationSec?: number | null;
    endedReason?: string | null;
    fromNumber?: string | null;
    source?: string | null;
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
    source: opts?.call?.source || opts?.source?.label || businessName,
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
// Per-source config (opts.source) overrides the outbound number and agent
// name, adds extra destinations, and can opt out of the global targets.
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

  const businessName = biz?.name ?? "";
  // Agent/display name now comes from the per-source config.
  const agentName = opts?.source?.agentName ?? "";
  const excludeGlobal = Boolean(opts?.source?.excludeFromGlobal);

  const creds = {
    accountSid: cred?.twilio_account_sid,
    keySid: cred?.twilio_api_key_sid,
    keySecret: cred?.twilio_api_key_secret,
    authToken: cred?.twilio_auth_token,
    // This source's own number wins; fall back to the account default.
    from: opts?.source?.fromNumber || cred?.twilio_number,
  };

  // ---- Team SMS (global crew + this source's extras) ----
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
  const globalNumbers = excludeGlobal
    ? []
    : splitList(target?.sms_to || process.env.DISPATCH_SMS_TO);
  const extraNumbers = splitList(opts?.source?.extraSmsTo);
  const numbers = Array.from(new Set([...globalNumbers, ...extraNumbers]));
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

  // ---- Caller SMS (to the caller, with a helpful link) — per source ----
  const callerLink = (opts?.source?.callerLink || "").trim();
  if (opts?.source?.callerSmsEnabled && callerNumber && callerLink) {
    const callerTemplate =
      (opts?.source?.callerSmsTemplate || "").trim() ||
      DEFAULT_CALLER_SMS_TEMPLATE;
    const callerBody = renderSmsTemplate(callerTemplate, {
      business: opts?.source?.label || businessName,
      agent: agentName,
      name: data.name ?? "",
      link: callerLink,
      link_label: opts?.source?.callerLinkLabel || "Link",
    });
    try {
      await sendSms(callerNumber, callerBody, creds);
    } catch (e) {
      console.error("Caller SMS failed:", e);
    }
  }

  // ---- Email summary (global; skipped when the source opts out) ----
  const emailTo = splitList(target?.email_to);
  if (
    !excludeGlobal &&
    target?.email_enabled &&
    emailConfigured() &&
    emailTo.length > 0
  ) {
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

  // ---- JSON push: global endpoint (unless opted out) + source extra ----
  const jsonTargets: { url: string; headers?: Record<string, string> }[] = [];
  if (!excludeGlobal && target?.json_enabled && target?.json_url) {
    jsonTargets.push({
      url: target.json_url,
      headers: target.json_headers ?? undefined,
    });
  }
  const extraJson = (opts?.source?.extraJsonUrl || "").trim();
  if (extraJson) jsonTargets.push({ url: extraJson });

  if (jsonTargets.length > 0) {
    let anyJson = false;
    for (const t of jsonTargets) {
      try {
        await fetch(t.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(t.headers ?? {}),
          },
          body: JSON.stringify({
            businessId,
            jobId,
            source: opts?.source?.label ?? null,
            ...data,
          }),
        });
        anyJson = true;
      } catch (e) {
        console.error(`JSON dispatch to ${t.url} failed:`, e);
      }
    }
    if (anyJson) {
      await supabase.from("jobs").update({ dispatched_json: true }).eq("id", jobId);
    }
  }
}

// Notify the team about a spam / no-intent call, only when notify_spam is on.
// Source-aware: brands the message with the source, sends from the source's
// number, and follows its recipient routing (global + extras, or extras only
// when the source opts out of global).
export async function notifySpamCall(
  supabase: SupabaseClient,
  businessId: string,
  info: { fromNumber?: string | null; durationSec?: number | null; endedReason?: string | null },
  source?: SourceContext | null
) {
  // Spam notification is now a per-source preference.
  if (!source?.notifySpam) return;

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

  const excludeGlobal = Boolean(source?.excludeFromGlobal);
  // Brand the notice with the source it came from, falling back to the account.
  const brand =
    (source?.label || "").trim() || biz?.name || "Front desk";
  const from = info.fromNumber || "unknown number";
  const dur = typeof info.durationSec === "number" ? ` (${info.durationSec}s)` : "";
  const body = `${brand}: spam/unknown call from ${from}${dur}. No job captured.`;

  const globalNumbers = excludeGlobal
    ? []
    : splitList(target?.sms_to || process.env.DISPATCH_SMS_TO);
  const extraNumbers = splitList(source?.extraSmsTo);
  const numbers = Array.from(new Set([...globalNumbers, ...extraNumbers]));
  if (numbers.length > 0) {
    const creds = {
      accountSid: cred?.twilio_account_sid,
      keySid: cred?.twilio_api_key_sid,
      keySecret: cred?.twilio_api_key_secret,
      authToken: cred?.twilio_auth_token,
      // This source's own number wins; fall back to the account default.
      from: source?.fromNumber || cred?.twilio_number,
    };
    for (const n of numbers) {
      try {
        await sendSms(n, body, creds);
      } catch (e) {
        console.error(`Spam notice to ${n} failed:`, e);
      }
    }
  }

  const emailTo = splitList(target?.email_to);
  if (!excludeGlobal && target?.email_enabled && emailConfigured() && emailTo.length > 0) {
    try {
      await sendEmail({ to: emailTo, subject: `Spam / unknown call — ${brand}`, text: body });
    } catch (e) {
      console.error("Spam email failed:", e);
    }
  }
}
