import { createBrowserClient } from "@supabase/ssr";

// Client-side Supabase client (browser). Uses the publishable key + RLS.
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
