import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// Streams a call recording by re-fetching a FRESH pre-signed URL from Vapi on
// every play (Vapi's raw storage URLs are private and its pre-signed URLs
// expire after ~30 min). RLS ensures the user can only reach their tenant's call.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data: call } = await supabase
    .from("calls")
    .select("vapi_call_id, recording_url")
    .eq("id", id)
    .maybeSingle();
  if (!call) return new NextResponse("not found", { status: 404 });

  let url: string | null = null;

  // Always prefer a fresh pre-signed URL from Vapi (publicly playable, short-lived).
  if (call.vapi_call_id && process.env.VAPI_API_KEY) {
    try {
      const r = await fetch(`https://api.vapi.ai/call/${call.vapi_call_id}`, {
        headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
        cache: "no-store",
      });
      if (r.ok) {
        const c = await r.json();
        const a = c?.artifact ?? {};
        url =
          a.presignedMonoUrl ??
          a.presignedStereoUrl ??
          a.recording?.mono?.combinedUrl ??
          a.recording?.stereoUrl ??
          a.recordingUrl ??
          a.stereoRecordingUrl ??
          null;
      }
    } catch {
      /* fall through to the stored URL */
    }
  }

  // Last resort: whatever we stored at call time (may be private/expired).
  if (!url) url = (call.recording_url as string | null) ?? null;

  if (!url) return new NextResponse("no recording", { status: 404 });
  return NextResponse.redirect(url);
}
