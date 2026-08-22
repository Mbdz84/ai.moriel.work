import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { dispatchJob, notifySpamCall, resolveCallbackPhone } from "@/lib/dispatch";
import { fetchCallExtract, getVapiAssistantName } from "@/lib/vapi";
import { validateAddress } from "@/lib/address";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// Vapi end-of-call webhook.
// Configure this URL in the Vapi assistant "Server URL":
//   https://ai.moriel.work/api/vapi/webhook
//
// Vapi sends several message types; we act on "end-of-call-report".
// NOTE: payload shape below is based on Vapi's documented format.
// Probe a real call once and adjust field paths if needed.
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
  // 1) Verify the request came from Vapi (shared secret header).
  const secret = req.headers.get("x-vapi-secret");
  if (secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const message = body?.message ?? body;
  const type = message?.type;

  // We only handle the final report. Ack everything else fast.
  if (type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignored: type });
  }

  const supabase = createSupabaseAdmin();

  // --- Identify tenant. Map the dialed number -> business. ---
  const call = message?.call ?? {};
  const toNumber = call?.phoneNumber?.number ?? call?.customer?.number ?? null;
  // The number the caller dialed from — used as the callback fallback when the
  // caller says "use the same number".
  const callerNumber = call?.customer?.number ?? null;

  // TODO: resolve business_id from the dialed number.
  // For the first single-business test, hardcode via env; multi-tenant lookup later.
  const businessId = process.env.DEFAULT_BUSINESS_ID ?? null;
  if (!businessId) {
    console.error("No business_id resolved for call", call?.id);
    return NextResponse.json({ ok: true, warn: "no business" });
  }

  // Disabled account: don't process or dispatch its calls.
  const { data: bizRow } = await supabase
    .from("businesses")
    .select("disabled")
    .eq("id", businessId)
    .maybeSingle();
  if (bizRow?.disabled) {
    console.warn("Business disabled — skipping call", call?.id);
    return NextResponse.json({ ok: true, disabled: true });
  }

  // --- Extract the structured data the assistant collected. ---
  type JobData = {
    name?: string;
    phone?: string;
    address?: string;
    property_type?: string;
    service_type?: string;
    vehicle?: string;
    qualified?: boolean;
    notes?: string;
    [key: string]: unknown;
  };
  // Artifact can live at message.artifact or message.call.artifact.
  const artifact = message?.artifact ?? call?.artifact ?? {};
  const structuredOutputs =
    artifact?.structuredOutputs ?? message?.analysis?.structuredOutputs ?? {};
  const firstOutput = Object.values(structuredOutputs)[0] as
    | { result?: JobData }
    | undefined;
  let data: JobData =
    firstOutput?.result ?? message?.analysis?.structuredData ?? {};

  // Extraction often finishes a few seconds AFTER this webhook fires, so if
  // the payload has no data, pull it from Vapi's call API (with one retry).
  if (
    (!data || Object.keys(data).length === 0) &&
    call?.id &&
    process.env.VAPI_API_KEY
  ) {
    let fetched = await fetchCallExtract(call.id);
    if (!fetched) {
      await sleep(3000);
      fetched = await fetchCallExtract(call.id);
    }
    if (fetched) data = fetched as JobData;
  }

  const endedReason = message?.endedReason ?? call?.endedReason ?? null;
  const durationSec = message?.durationSeconds
    ? Math.round(message.durationSeconds)
    : null;

  // --- Source: which assistant/brand handled this call. Pulls the per-source
  // routing config (label, outbound number, agent name, extra destinations),
  // falling back to the assistant's own name for the label. ---
  const assistantId: string | null =
    call?.assistantId ?? message?.assistantId ?? null;
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
  if (assistantId) {
    const { data: src } = await supabase
      .from("sources")
      .select(
        "label, from_number, agent_name, extra_sms_to, extra_json_url, exclude_from_global, notify_spam, caller_sms_enabled, caller_link, caller_link_label, caller_sms_template"
      )
      .eq("business_id", businessId)
      .eq("provider", "vapi")
      .eq("assistant_id", assistantId)
      .maybeSingle();
    sourceCfg = (src as SourceCfg | null) ?? null;
    source =
      (sourceCfg?.label as string | null)?.trim() ||
      (await getVapiAssistantName(assistantId));
  }

  // Per-source routing object shared by job dispatch and the spam notice.
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

  // --- Normalize the spoken address via Google (optional, best-effort). ---
  const validated = await validateAddress(data?.address);
  const dbAddress = validated ? validated.oneLine : data?.address ?? null;
  if (validated) data.address = validated.oneLine;

  // Did the agent actually capture a usable job?
  const hasData = Boolean(
    data?.name ||
      data?.phone ||
      data?.address ||
      data?.service_type ||
      data?.property_type
  );
  const spam = !hasData;

  // Any extra keys the agent collected beyond the known job fields.
  const details: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (!KNOWN_JOB_KEYS.has(k) && v != null && v !== "") details[k] = v;
  }
  // Flag whether Google confirmed the address (drives the dashboard ✓).
  if (validated) details.address_verified = validated.verified;

  // 2) Store the call.
  const { data: callRow, error: callErr } = await supabase
    .from("calls")
    .insert({
      business_id: businessId,
      provider: "vapi",
      vapi_call_id: call?.id ?? null,
      from_number: callerNumber,
      to_number: toNumber,
      started_at: message?.startedAt ?? null,
      ended_at: message?.endedAt ?? null,
      duration_sec: durationSec,
      status: "completed",
      ended_reason: endedReason,
      spam,
      assistant_id: assistantId,
      source,
      cost: message?.cost ?? call?.cost ?? null,
      recording_url:
        artifact?.recordingUrl ??
        artifact?.stereoRecordingUrl ??
        artifact?.recording?.stereoUrl ??
        artifact?.recording?.mono?.combinedUrl ??
        artifact?.recording?.url ??
        null,
      transcript: artifact?.transcript ?? message?.transcript ?? null,
    })
    .select("id")
    .single();

  if (callErr) {
    console.error("call insert failed", callErr);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const recordingUrl =
    artifact?.recordingUrl ??
    artifact?.stereoRecordingUrl ??
    artifact?.recording?.stereoUrl ??
    artifact?.recording?.mono?.combinedUrl ??
    artifact?.recording?.url ??
    null;
  const transcript = artifact?.transcript ?? message?.transcript ?? null;

  // 3) No usable job → treat as spam/no-intent. Optionally notify, then stop.
  if (!hasData) {
    await notifySpamCall(
      supabase,
      businessId,
      { fromNumber: callerNumber, durationSec, endedReason },
      sourceObj
    );
    return NextResponse.json({ ok: true, call_id: callRow.id, spam: true });
  }

  // 4) Store the job (with any extra collected details).
  const qualified = data?.qualified !== false;
  const { data: jobRow } = await supabase
    .from("jobs")
    .insert({
      business_id: businessId,
      call_id: callRow.id,
      customer_name: data?.name ?? null,
      phone: resolveCallbackPhone(data?.phone, callerNumber) || null,
      address: dbAddress,
      property_type: data?.property_type ?? null,
      service_type: data?.service_type ?? null,
      qualified,
      notes: data?.notes ?? null,
      details: Object.keys(details).length ? details : {},
    })
    .select("id")
    .single();

  // 5) Dispatch: team SMS + JSON + caller SMS + email.
  //    Failures are logged inside dispatchJob and don't fail the webhook.
  if (jobRow?.id) {
    await dispatchJob(supabase, businessId, jobRow.id, data, callerNumber, {
      smsAddress: validated?.twoLine,
      source: sourceObj,
      call: {
        recordingUrl,
        transcript,
        durationSec,
        endedReason,
        fromNumber: callerNumber,
        source,
      },
    });
  }

  return NextResponse.json({ ok: true, call_id: callRow.id, job_id: jobRow?.id });
}
