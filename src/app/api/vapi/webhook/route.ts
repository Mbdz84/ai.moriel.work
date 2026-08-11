import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

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

  // TODO: resolve business_id from the dialed number.
  // For the first single-business test, hardcode via env; multi-tenant lookup later.
  const businessId = process.env.DEFAULT_BUSINESS_ID ?? null;
  if (!businessId) {
    console.error("No business_id resolved for call", call?.id);
    return NextResponse.json({ ok: true, warn: "no business" });
  }

  // --- Extract the structured data the assistant collected. ---
  // If you configure a Vapi "structured output" / analysis schema,
  // it arrives here. Otherwise parse message.analysis.structuredData.
  const data = message?.analysis?.structuredData ?? {};
  const endedReason = message?.endedReason ?? call?.endedReason ?? null;

  // 2) Store the call.
  const { data: callRow, error: callErr } = await supabase
    .from("calls")
    .insert({
      business_id: businessId,
      vapi_call_id: call?.id ?? null,
      from_number: call?.customer?.number ?? null,
      to_number: toNumber,
      started_at: message?.startedAt ?? null,
      ended_at: message?.endedAt ?? null,
      duration_sec: message?.durationSeconds
        ? Math.round(message.durationSeconds)
        : null,
      status: "completed",
      ended_reason: endedReason,
      recording_url: message?.recordingUrl ?? message?.stereoRecordingUrl ?? null,
      transcript: message?.transcript ?? null,
    })
    .select("id")
    .single();

  if (callErr) {
    console.error("call insert failed", callErr);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  // 3) Store the job (only if the agent captured something usable).
  const qualified = data?.qualified !== false;
  const { data: jobRow } = await supabase
    .from("jobs")
    .insert({
      business_id: businessId,
      call_id: callRow.id,
      customer_name: data?.name ?? null,
      phone: data?.phone ?? call?.customer?.number ?? null,
      address: data?.address ?? null,
      property_type: data?.property_type ?? null,
      service_type: data?.service_type ?? null,
      urgency: data?.urgency ?? null,
      qualified,
      notes: data?.notes ?? null,
    })
    .select("id")
    .single();

  // 4) Dispatch (SMS via Twilio + custom JSON). Fire-and-log.
  //    TODO Phase 3: implement sendSms() and postJson() with retry.
  //    Left as stubs so the pipeline is visible end-to-end.
  // await dispatch(businessId, jobRow, supabase);

  return NextResponse.json({ ok: true, call_id: callRow.id, job_id: jobRow?.id });
}
