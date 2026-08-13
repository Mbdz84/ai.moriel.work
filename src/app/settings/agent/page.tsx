import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";
import { getVapiAssistant } from "@/lib/vapi";
import { saveAgent } from "./actions";

export default async function AgentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; sync?: string }>;
}) {
  const { saved, sync } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");

  const { data: agent } = await supabase
    .from("agents")
    .select("vapi_assistant_id, greeting, system_prompt, knowledge_base")
    .eq("business_id", businessId)
    .maybeSingle();

  const assistantId = agent?.vapi_assistant_id ?? "";

  // Pull the LIVE values from Vapi so you edit what's actually running.
  // Fall back to our cached copy if Vapi can't be reached.
  const live = assistantId ? await getVapiAssistant(assistantId) : null;
  const source = live ? "live" : assistantId ? "cache" : "none";

  const greeting = live?.firstMessage ?? agent?.greeting ?? "";
  const systemPrompt = live?.systemPrompt ?? agent?.system_prompt ?? "";
  const knowledgeBase = live?.knowledgeBase ?? agent?.knowledge_base ?? "";

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";
  const area = `${input} min-h-24`;

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Agent</h1>
        <SettingsNav active="agent" />
      </div>

      <p className="text-sm text-neutral-500">
        Voice, model, and timeouts stay in Vapi. Here you edit the script and
        knowledge base — pulled live from your assistant and pushed back on save.
      </p>

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Saved.{" "}
          {sync === "ok" && "Synced to Vapi — live on your next call."}
          {sync === "failed" &&
            "But the Vapi sync failed (check the Assistant ID / VAPI_API_KEY). Your edits are cached."}
          {sync === "skipped" &&
            "Add your Vapi Assistant ID to push changes to the live agent."}
        </p>
      )}

      {source === "cache" && (
        <p className="rounded bg-amber-50 text-amber-700 text-sm px-3 py-2">
          Couldn&apos;t reach Vapi — showing your last saved copy. Check the
          Assistant ID and that VAPI_API_KEY is set.
        </p>
      )}

      <form action={saveAgent} className="space-y-6">
        <div className="space-y-1">
          <label className={label}>Vapi Assistant ID</label>
          <input
            name="vapi_assistant_id"
            defaultValue={assistantId}
            placeholder="from dashboard.vapi.ai/assistants/<ID>"
            className={input}
          />
          <p className="text-xs text-neutral-500">
            {source === "live"
              ? "Connected — fields below are live from Vapi."
              : "Required to pull and push the live agent."}
          </p>
        </div>

        <div className="space-y-1">
          <label className={label}>First message (greeting)</label>
          <textarea name="greeting" defaultValue={greeting} className={area} />
        </div>

        <div className="space-y-1">
          <label className={label}>System prompt</label>
          <textarea
            name="system_prompt"
            defaultValue={systemPrompt}
            className={`${area} min-h-64`}
          />
        </div>

        <div className="space-y-1">
          <label className={label}>Knowledge base</label>
          <textarea
            name="knowledge_base"
            defaultValue={knowledgeBase}
            className={`${area} min-h-40`}
          />
          <p className="text-xs text-neutral-500">
            What you do / don&apos;t do, service area, pricing rules. Appended to
            the prompt so the agent can reject out-of-scope calls.
          </p>
        </div>

        <button
          type="submit"
          className="rounded bg-black text-white px-4 py-2 text-sm"
        >
          Save &amp; sync to Vapi
        </button>
      </form>
    </main>
  );
}
