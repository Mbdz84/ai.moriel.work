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

  const assistantId = str("vapi_assistant_id");
  const script = {
    firstMessage: str("greeting"),
    systemPrompt: str("system_prompt"),
    knowledgeBase: str("knowledge_base"),
  };

  // Cache in our DB so edits aren't lost if the Vapi sync fails.
  await supabase
    .from("agents")
    .update({
      vapi_assistant_id: assistantId || null,
      greeting: script.firstMessage,
      system_prompt: script.systemPrompt,
      knowledge_base: script.knowledgeBase,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  // Push to the live Vapi assistant (source of truth).
  let sync = "skipped";
  if (assistantId && process.env.VAPI_API_KEY) {
    try {
      await updateVapiAssistant(assistantId, script);
      sync = "ok";
    } catch (e) {
      console.error("Vapi sync failed:", e);
      sync = "failed";
    }
  }

  redirect(`/settings/agent?saved=1&sync=${sync}`);
}
