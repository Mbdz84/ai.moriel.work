import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { listVapiAssistants, getAssistantPhoneNumbers } from "@/lib/vapi";
import {
  listElevenLabsAgents,
  getElevenLabsAgentPhones,
} from "@/lib/elevenlabs";
import SettingsNav from "@/components/SettingsNav";
import SourceCard, { type SourceCfg } from "@/components/SourceCard";
import { saveSources } from "./actions";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  // Both voice providers, merged into one list tagged by platform.
  const [vapiAgents, elAgents, vapiPhones, elPhones] = await Promise.all([
    listVapiAssistants(),
    listElevenLabsAgents(),
    getAssistantPhoneNumbers(),
    getElevenLabsAgentPhones(),
  ]);
  const assistants = [
    ...vapiAgents.map((a) => ({ ...a, platform: "vapi" as const })),
    ...elAgents.map((a) => ({ ...a, platform: "11labs" as const })),
  ];
  const phoneByAssistant = { ...vapiPhones, ...elPhones };

  const { data: existing } = await supabase
    .from("sources")
    .select(
      "assistant_id, label, agent_name, from_number, extra_sms_to, extra_json_url, exclude_from_global, notify_spam, caller_sms_enabled, caller_link, caller_link_label, caller_sms_template"
    )
    .eq("business_id", businessId);
  const cfgFor = new Map(
    ((existing ?? []) as (SourceCfg & { assistant_id: string })[]).map((r) => [
      r.assistant_id,
      r,
    ])
  );

  const { data: cred } = await supabase
    .from("credentials")
    .select("twilio_number")
    .eq("business_id", businessId)
    .maybeSingle();
  const accountNumber = (cred?.twilio_number as string | null) || "";

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Sources</h1>
        <SettingsNav active="sources" admin={true} />
      </div>

      <p className="text-sm text-neutral-500">
        Each source is one voice agent &mdash; on Vapi or ElevenLabs. Its
        prompt, voice, and behavior are managed on that platform &mdash; here you
        set how its calls are
        routed: the brand it represents, the name it signs texts with, the number
        it texts from, who gets notified, and whether it texts the caller a link.
      </p>

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Saved.
        </p>
      )}

      {assistants.length === 0 ? (
        <p className="rounded bg-amber-50 text-amber-700 text-sm px-3 py-2">
          No assistants found. Make sure VAPI_API_KEY is set on the server.
        </p>
      ) : (
        <form action={saveSources} className="space-y-4">
          <div className="space-y-4">
            {assistants.map((a) => (
              <SourceCard
                key={`${a.platform}:${a.id}`}
                assistant={a}
                platform={a.platform}
                cfg={cfgFor.get(a.id)}
                accountNumber={accountNumber}
                assignedNumber={phoneByAssistant[a.id]?.number || ""}
                assignedProvider={phoneByAssistant[a.id]?.provider || ""}
              />
            ))}
          </div>
          <button
            type="submit"
            className="rounded bg-black text-white px-4 py-2 text-sm"
          >
            Save sources
          </button>
        </form>
      )}
    </main>
  );
}
