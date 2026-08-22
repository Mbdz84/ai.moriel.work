import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { dispatchJob, notifySpamCall, resolveCallbackPhone } from "@/lib/dispatch";
import {
  verifyElevenLabsSignature,
  mapDataCollection,
  type ElevenLabsJob,
} from "@/lib/elevenlabs";
import { validateAddress } from "@/lib/address";

// ============================================================
// ElevenLabs Agents Platform post-call webhook.
// Configure in ElevenLabs: Agent -> Post-call webhook ->
//   https://ai.moriel.work/api/elevenlabs/webhook
// with a shared secret matching ELEVENLABS_WEBHOOK_SECRET.
//
// Payload: { type, data, event_timestamp }. We act on
// "post_call_transcription". Extracted fields live in
// data.analysis.data_collection_results.
// ============================================================

const KNOWN_JOB_KEYS = new Set([
  "name",
  "phone",
  "address",
  "property_type",
  "service_type",
  "vehicle",
  "qualified",
  "notes",
]);

export async function POST(req: NextRequest) {
  // Raw body first — the HMAC is computed over the exact bytes.
  const raw = await req.text();
  const ok = verifyElevenLabsSignature(
    raw,
    req.headers.get("elevenlabs-signature"),
    process.env.ELEVENLABS_WEBHOOK_SECRET
  );
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const type = body?.type as string | undefined;
  if (type !== "post_call_transcription") {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const data = (body?.data ?? {}) as Record<string, unknown>;
  const meta = (data?.metadata ?? {}) as Record<string, unknown>;
  const phoneMeta = (meta?.phone_call ?? {}) as Record<string, unknown>;

  const supabase = createSupabaseAdmin();

  const businessId = process.env.DEFAULT_BUSINESS_ID ?? null;
  if (!businessId) {
    console.error("EL webhook: no business_id", data?.conversation_id);
    return NextResponse.json({ ok: true, warn: "no business" });
  }

  // Disabled account: don't process or dispatch its calls.
  const { data: bizRow } = await supabase
    .from("businesses")
    .select("disabled")
    .eq("id", businessId)
    .maybeSingle();
  if (bizRow?.disabled) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const agentId = (data?.agent_id as string | null) ?? null;
  const conversationId = (data?.conversation_id as string | null) ?? null;

  const callerNumber =
    (phoneMeta?.external_number as string | null) ??
    (phoneMeta?.from_number as string | null) ??
    (meta?.from_number as string | null) ??
    null;
  const toNumber =
    (phoneMeta?.agent_number as string | null) ??
    (meta?.to_number as string | null) ??
    null;

  // --- Resolve the source (ElevenLabs provider) by agent id. ---
  type SourceCfg = {
    label: string | null;
    from_number: string | null;
    agent_name: string | null;
    extra_sms_to: string | null;
    extra_json_url: string | null;
    exclude_from_global: boolean | null;
    notify_spam: boolean | null;
    caller_sms_enabled: boolean | null;
    caller_link: string | null;
    caller_link_label: string | null;
    caller_sms_template: string | null;
  };
  let sourceCfg: SourceCfg | null = null;
  let source: string | null = null;
  if (agentId) {
    const { data: src } = await supabase
      .from("sources")
      .select(
        "label, from_number, agent_name, extra_sms_to, extra_json_url, exclude_from_global, notify_spam, caller_sms_enabled, caller_link, caller_link_label, caller_sms_template"
      )
      .eq("business_id", businessId)
      .eq("provider", "11labs")
      .eq("assistant_id", agentId)
      .maybeSingle();
    sourceCfg = (src as SourceCfg | null) ?? null;
    source = (sourceCfg?.label as string | null)?.trim() || agentId;
  }

  const sourceObj = {
    label: source,
    fromNumber: sourceCfg?.from_number ?? null,
    agentName: sourceCfg?.agent_name ?? null,
    extraSmsTo: sourceCfg?.extra_sms_to ?? null,
    extraJsonUrl: sourceCfg?.extra_json_url ?? null,
    excludeFromGlobal: Boolean(sourceCfg?.exclude_from_global),
    notifySpam: Boolean(sourceCfg?.notify_spam),
    callerSmsEnabled: Boolean(sourceCfg?.caller_sms_enabled),
    callerLink: sourceCfg?.caller_link ?? null,
    callerLinkLabel: sourceCfg?.caller_link_label ?? null,
    callerSmsTemplate: sourceCfg?.caller_sms_template ?? null,
  };

  // --- Extracted structured fields. ---
  const analysis = (data?.analysis ?? {}) as Record<string, unknown>;
  let jobData: ElevenLabsJob = mapDataCollection(
    analysis?.data_collection_results as Record<string, unknown> | undefined
  );

  // --- Address validation (best-effort). ---
  const validated = await validateAddress(jobData?.address as string | undefined);
  const dbAddress = validated ? validated.oneLine : jobData?.address ?? null;
  if (validated) jobData = { ...jobData, address: validated.oneLine };

  const durationSec =
    typeof meta?.call_duration_secs === "number"
      ? Math.round(meta.call_duration_secs as number)
      : null;

  // Build a plain-text transcript from the turn array, if present.
  const turns = (data?.transcript ?? []) as {
    role?: string;
    message?: string;
  }[];
  const transcript =
    (Array.isArray(turns) && turns.length
      ? turns
          .filter((t) => t?.message)
          .map((t) => `${t.role ?? "?"}: ${t.message}`)
          .join("\n")
      : (analysis?.transcript_summary as string | null)) || null;

  const hasData = Boolean(
    jobData?.name ||
      jobData?.phone ||
      jobData?.address ||
      jobData?.service_type ||
      jobData?.property_type
  );
  const spam = !hasData;

  const details: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(jobData ?? {})) {
    if (!KNOWN_JOB_KEYS.has(k) && v != null && v !== "") details[k] = v;
  }
  if (validated) details.address_verified = validated.verified;

  // Store the call.
  const { data: callRow, error: callErr } = await supabase
    .from("calls")
    .insert({
      business_id: businessId,
      provider: "11labs",
      vapi_call_id: conversationId,
      from_number: callerNumber,
      to_number: toNumber,
      started_at: null,
      ended_at: null,
      duration_sec: durationSec,
      status: "completed",
      ended_reason: null,
      spam,
      assistant_id: agentId,
      source,
      cost: (meta?.cost as number | null) ?? null,
      recording_url: null,
      transcript,
    })
    .select("id")
    .single();

  if (callErr) {
    console.error("EL call insert failed", callErr);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  if (!hasData) {
    await notifySpamCall(
      supabase,
      businessId,
      { fromNumber: callerNumber, durationSec, endedReason: null },
      sourceObj
    );
    return NextResponse.json({ ok: true, call_id: callRow.id, spam: true });
  }

  const qualified = jobData?.qualified !== false;
  const { data: jobRow } = await supabase
    .from("jobs")
    .insert({
      business_id: businessId,
      call_id: callRow.id,
      customer_name: jobData?.name ?? null,
      phone: resolveCallbackPhone(jobData?.phone as string, callerNumber) || null,
      address: dbAddress,
      property_type: jobData?.property_type ?? null,
      service_type: jobData?.service_type ?? null,
      qualified,
      notes: jobData?.notes ?? null,
      details: Object.keys(details).length ? details : {},
    })
    .select("id")
    .single();

  if (jobRow?.id) {
    await dispatchJob(supabase, businessId, jobRow.id, jobData, callerNumber, {
      smsAddress: validated?.twoLine,
      source: sourceObj,
      call: {
        recordingUrl: null,
        transcript,
        durationSec,
        endedReason: null,
        fromNumber: callerNumber,
        source,
      },
    });
  }

  return NextResponse.json({ ok: true, call_id: callRow.id, job_id: jobRow?.id });
}
