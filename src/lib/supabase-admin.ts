import { createClient } from "@supabase/supabase-js";

// SERVICE-ROLE client. Bypasses RLS. SERVER-ONLY.
// Used by the Vapi webhook to write calls/jobs. Never import in client code.
export function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
