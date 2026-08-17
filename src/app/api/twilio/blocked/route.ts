import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Logs a spam / blocked caller from the Twilio "press 1" gate into the
// dashboard as a spam row (no job, no recording). Call this from the Studio
// flow's "didn't press 1" branch.
//
// Configure in Studio (Make HTTP Request widget):
//   POST https://ai.moriel.work/api/twilio/blocked?key=YOUR_TWILIO_INGEST_KEY
//   Content-Type: application/json
//   Body: { "from": "{{contact.channel.address}}", "to": "{{trigger.call.To}}" }
//
// Set TWILIO_INGEST_KEY in your env to the same value used in the URL.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("x-key");
  if (!process.env.TWILIO_INGEST_KEY || key !== process.env.TWILIO_INGEST_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Accept JSON or form-encoded bodies (Studio can send either).
  let from: string | null = null;
  let to: string | null = null;
  let callSid: string | null = null;
  try {
    const b = await req.json();
    from = b.from ?? null;
    to = b.to ?? null;
    callSid = b.call_sid ?? b.callSid ?? null;
  } catch {
    try {
      const f = await req.formData();
      from = (f.get("from") as string) ?? null;
      to = (f.get("to") as string) ?? null;
      callSid = (f.get("call_sid") as string) ?? null;
    } catch {
      /* no body */
    }
  }

  const businessId = process.env.DEFAULT_BUSINESS_ID ?? null;
  if (!businessId) {
    return NextResponse.json({ ok: true, warn: "no business" });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("calls").insert({
    business_id: businessId,
    twilio_call_sid: callSid,
    from_number: from,
    to_number: to,
    duration_sec: 0,
    status: "blocked",
    ended_reason: "no keypress (spam gate)",
    spam: true,
  });

  if (error) {
    console.error("blocked-call insert failed", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
