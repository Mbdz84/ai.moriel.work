import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// Streams a call recording by re-fetching a fresh URL from Vapi (recording
// URLs can expire). RLS ensures the user can only access their own tenant's
// call. Redirects to the current recording URL.
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

  let url = (call.recording_url as string | null) ?? null;

  // Prefer a fresh URL from Vapi.
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
          a.recordingUrl ??
          a.stereoRecordingUrl ??
          a.recording?.stereoUrl ??
          a.recording?.mono?.combinedUrl ??
          a.recording?.url ??
          url;
      }
    } catch {
      /* fall back to stored url */
    }
  }

  if (!url) return new NextResponse("no recording", { status: 404 });
  return NextResponse.redirect(url);
}
