import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { getTwilioBalance } from "@/lib/twilio";

// Returns the active business's Twilio balance for the nav drawer.
// Admin-only; returns null when not connected or not permitted.
export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ twilio: null });

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId || !isAdmin(active?.role)) {
    return NextResponse.json({ twilio: null });
  }

  const { data: cred } = await supabase
    .from("credentials")
    .select(
      "twilio_account_sid, twilio_api_key_sid, twilio_api_key_secret, twilio_auth_token"
    )
    .eq("business_id", businessId)
    .maybeSingle();

  const twilio = await getTwilioBalance({
    accountSid: (cred?.twilio_account_sid as string | null) ?? "",
    keySid: (cred?.twilio_api_key_sid as string | null) ?? "",
    keySecret: (cred?.twilio_api_key_secret as string | null) ?? "",
    authToken: (cred?.twilio_auth_token as string | null) ?? "",
  });

  return NextResponse.json({ twilio });
}
