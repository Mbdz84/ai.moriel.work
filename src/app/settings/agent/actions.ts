"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { updateVapiAssistant } from "@/lib/vapi";
import {
  composeSystemPrompt,
  renderGreeting,
  type Faq,
  type CollectField,
} from "@/lib/agent-prompt";
import type { BusinessHours } from "@/lib/hours";

function parseJson<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
  const displayName = str("display_name");
  const greeting = str("greeting");
  const persona = str("persona");
  const ask = str("ask_questions");
  const dont = str("out_of_scope");
  const spamHandling = str("spam_handling");
  const timezone = str("timezone") || "America/Chicago";
  const afterHours = str("after_hours_prompt");
  const hoursEnabled = formData.get("hours_enabled") === "on";
  const voiceId = str("voice_id");
  const voiceProvider = str("voice_provider") || "11labs";

  const businessHours = parseJson<BusinessHours>(
    formData.get("business_hours"),
    {}
  );
  const faqs = parseJson<Faq[]>(formData.get("faqs"), []);
  const collectFields = parseJson<CollectField[]>(
    formData.get("collect_fields"),
    []
  );

  await supabase
    .from("agents")
    .update({
      vapi_assistant_id: assistantId || null,
      display_name: displayName || null,
      greeting,
      persona,
      ask_questions: ask,
      out_of_scope: dont,
      spam_handling: spamHandling,
      timezone,
      hours_enabled: hoursEnabled,
      business_hours: businessHours,
      after_hours_prompt: afterHours,
      faqs,
      collect_fields: collectFields,
      voice_id: voiceId,
      voice_provider: voiceProvider,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId);

  let sync = "skipped";
  if (assistantId && process.env.VAPI_API_KEY) {
    try {
      await updateVapiAssistant(assistantId, {
        firstMessage: renderGreeting(greeting, {
          business: active?.name ?? "",
          agent: displayName,
        }),
        systemPrompt: composeSystemPrompt({
          persona,
          ask_questions: ask,
          collect_fields: collectFields,
          faqs,
          out_of_scope: dont,
          spam_handling: spamHandling,
          hours_enabled: hoursEnabled,
          business_hours: businessHours,
          after_hours_prompt: afterHours,
          timezone,
        }),
        knowledgeBase: "",
        voice: voiceId ? { provider: voiceProvider, voiceId } : null,
      });
      sync = "ok";
    } catch (e) {
      console.error("Vapi sync failed:", e);
      sync = "failed";
    }
  }

  redirect(`/settings/agent?saved=1&sync=${sync}`);
}
