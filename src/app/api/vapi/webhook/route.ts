import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { dispatchJob, resolveCallbackPhone } from "@/lib/dispatch";
import { fetchCallExtract } from "@/lib/vapi";
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

  // --- Extract the structured data the assistant collected. ---
  // Vapi (2026 Structured Outputs) delivers results keyed by the output's UUID
  // at message.artifact.structuredOutputs[<id>].result. We attached ONE output
  // ("Locksmith Job"), so grab the first result. Falls back to the legacy
  // message.analysis.structuredData path for older assistants.
  type JobData = {
    name?: string;
    phone?: string;
    address?: string;
    property_type?: string;
    service_type?: string;
    vehicle?: string;
    qualified?: boolean;
    notes?: string;
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

  // --- Normalize the spoken address via Google (optional, best-effort). ---
  // Stores the clean single line; the SMS shows a two-line postal format.
  const validated = await validateAddress(data?.address);
  const dbAddress = validated ? validated.oneLine : data?.address ?? null;
  if (validated) data.address = validated.oneLine;

  // 2) Store the call.
  const { data: callRow, error: callErr } = await supabase
    .from("calls")
    .insert({
      business_id: businessId,
      vapi_call_id: call?.id ?? null,
      from_number: callerNumber,
      to_number: toNumber,
      started_at: message?.startedAt ?? null,
      ended_at: message?.endedAt ?? null,
      duration_sec: message?.durationSeconds
        ? Math.round(message.durationSeconds)
        : null,
      status: "completed",
      ended_reason: endedReason,
      // Vapi reports the call cost (USD) in the end-of-call-report.
      cost: message?.cost ?? call?.cost ?? null,
      // Recording + transcript live under message.artifact in end-of-call-report.
      // Stored as a "has recording" marker + fallback; playback re-fetches a
      // fresh URL from Vapi via /api/recording/[id] (URLs can expire).
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

  // 3) Store the job (only if the agent captured something usable).
  //    Persist the resolved callback number so "use the same number" still
  //    lands a real phone number, and the validated address.
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
    })
    .select("id")
    .single();

  // 4) Dispatch: SMS via Twilio + optional custom JSON push.
  //    Failures are logged inside dispatchJob and don't fail the webhook.
  if (jobRow?.id) {
    await dispatchJob(supabase, businessId, jobRow.id, data, callerNumber, {
      smsAddress: validated?.twoLine,
    });
  }

  return NextResponse.json({ ok: true, call_id: callRow.id, job_id: jobRow?.id });
}
