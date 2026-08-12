"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { updateVapiAssistant } from "@/lib/vapi";

export async function saveAgent(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("business_id")
    .maybeSingle();
  const businessId = membership?.business_id as string | undefined;
  if (!businessId) redirect("/dashboard");

  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const num = (k: string) => {
    const v = parseInt(str(k), 10);
    return Number.isFinite(v) ? v : null;
  };

  const assistantId = str("vapi_assistant_id");

  const agentValues = {
    vapi_assistant_id: assistantId || null,
    display_name: str("display_name") || "Receptionist",
    greeting: str("greeting"),
    system_prompt: str("system_prompt"),
    voice_provider: str("voice_provider") || "11labs",
    voice_id: str("voice_id"),
    language: str("language") || "en",
    silence_timeout_sec: num("silence_timeout_sec"),
    max_duration_sec: num("max_duration_sec"),
    updated_at: new Date().toISOString(),
  };

  await supabase.from("agents").update(agentValues).eq("business_id", businessId);

  const kb = {
    kb_we_do: str("kb_we_do"),
    kb_we_dont: str("kb_we_dont"),
    service_area: str("service_area"),
    pricing_notes: str("pricing_notes"),
  };
  await supabase.from("businesses").update(kb).eq("id", businessId);

  // Sync to Vapi if we have an assistant ID + API key.
  let sync = "skipped";
  if (assistantId && process.env.VAPI_API_KEY) {
    try {
      await updateVapiAssistant(assistantId, agentValues, kb);
      sync = "ok";
    } catch (e) {
      console.error("Vapi sync failed:", e);
      sync = "failed";
    }
  }

  redirect(`/settings/agent?saved=1&sync=${sync}`);
}
