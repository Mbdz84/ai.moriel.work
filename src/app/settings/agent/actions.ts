"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { updateVapiAssistant } from "@/lib/vapi";

// Builds the full Vapi system prompt from the structured question fields.
function composePrompt(persona: string, ask: string, dont: string): string {
  const parts: string[] = [];
  if (persona.trim()) parts.push(persona.trim());
  if (ask.trim()) parts.push(`# WHAT TO ASK / COLLECT\n${ask.trim()}`);
  if (dont.trim()) parts.push(`# WHAT WE DON'T DO\n${dont.trim()}`);
  return parts.join("\n\n");
}

export async function saveAgent(formData: FormData) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const assistantId = str("vapi_assistant_id");
  const greeting = str("greeting");
  const persona = str("persona");
  const ask = str("ask_questions");
  const dont = str("out_of_scope");

  await supabase
    .from("agents")
    .update({
      vapi_assistant_id: assistantId || null,
      greeting,
      persona,
      ask_questions: ask,
      out_of_scope: dont,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  let sync = "skipped";
  if (assistantId && process.env.VAPI_API_KEY) {
    try {
      await updateVapiAssistant(assistantId, {
        firstMessage: greeting,
        systemPrompt: composePrompt(persona, ask, dont),
        knowledgeBase: "",
      });
      sync = "ok";
    } catch (e) {
      console.error("Vapi sync failed:", e);
      sync = "failed";
    }
  }

  redirect(`/settings/agent?saved=1&sync=${sync}`);
}
