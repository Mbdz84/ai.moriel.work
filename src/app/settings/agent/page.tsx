import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import SettingsNav from "@/components/SettingsNav";
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

  const { data: membership } = await supabase
    .from("memberships")
    .select("business_id, businesses(kb_we_do, kb_we_dont, service_area, pricing_notes)")
    .maybeSingle();
  const businessId = membership?.business_id as string | undefined;
  if (!businessId) redirect("/dashboard");

  const kb = membership?.businesses as
    | {
        kb_we_do: string | null;
        kb_we_dont: string | null;
        service_area: string | null;
        pricing_notes: string | null;
      }
    | undefined;

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";
  const area = `${input} min-h-24`;

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Agent</h1>
        <SettingsNav active="agent" />
      </div>

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Saved.{" "}
          {sync === "ok" && "Synced to Vapi — live on your next call."}
          {sync === "failed" &&
            "But the Vapi sync failed (check the assistant ID / API key). Settings are still saved."}
          {sync === "skipped" &&
            "Add your Vapi Assistant ID below to push changes to the live agent."}
        </p>
      )}

      <form action={saveAgent} className="space-y-6">
        <section className="space-y-3">
          <h2 className="font-semibold">Connection</h2>
          <div className="space-y-1">
            <label className={label}>Vapi Assistant ID</label>
            <input
              name="vapi_assistant_id"
              defaultValue={agent?.vapi_assistant_id ?? ""}
              placeholder="from dashboard.vapi.ai/assistants/<ID>"
              className={input}
            />
            <p className="text-xs text-neutral-500">
              Required to push these settings to the live agent.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Voice &amp; behavior</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={label}>Voice provider</label>
              <select
                name="voice_provider"
                defaultValue={agent?.voice_provider ?? "11labs"}
                className={input}
              >
                <option value="11labs">ElevenLabs</option>
                <option value="cartesia">Cartesia</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={label}>Voice ID</label>
              <input
                name="voice_id"
                defaultValue={agent?.voice_id ?? ""}
                placeholder="voice id from provider"
                className={input}
              />
            </div>
            <div className="space-y-1">
              <label className={label}>Language</label>
              <input
                name="language"
                defaultValue={agent?.language ?? "en"}
                className={input}
              />
            </div>
            <div className="space-y-1">
              <label className={label}>Display name</label>
              <input
                name="display_name"
                defaultValue={agent?.display_name ?? "Receptionist"}
                className={input}
              />
            </div>
            <div className="space-y-1">
              <label className={label}>Silence timeout (sec)</label>
              <input
                name="silence_timeout_sec"
                type="number"
                defaultValue={agent?.silence_timeout_sec ?? 20}
                className={input}
              />
            </div>
            <div className="space-y-1">
              <label className={label}>Max duration (sec)</label>
              <input
                name="max_duration_sec"
                type="number"
                defaultValue={agent?.max_duration_sec ?? 600}
                className={input}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Script</h2>
          <div className="space-y-1">
            <label className={label}>Greeting (first message)</label>
            <textarea
              name="greeting"
              defaultValue={agent?.greeting ?? ""}
              className={area}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>System prompt</label>
            <textarea
              name="system_prompt"
              defaultValue={agent?.system_prompt ?? ""}
              className={`${area} min-h-48`}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Knowledge base (qualification filter)</h2>
          <div className="space-y-1">
            <label className={label}>What we do</label>
            <textarea name="kb_we_do" defaultValue={kb?.kb_we_do ?? ""} className={area} />
          </div>
          <div className="space-y-1">
            <label className={label}>What we do NOT do</label>
            <textarea name="kb_we_dont" defaultValue={kb?.kb_we_dont ?? ""} className={area} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={label}>Service area</label>
              <input
                name="service_area"
                defaultValue={kb?.service_area ?? ""}
                className={input}
              />
            </div>
            <div className="space-y-1">
              <label className={label}>Pricing notes</label>
              <input
                name="pricing_notes"
                defaultValue={kb?.pricing_notes ?? ""}
                className={input}
              />
            </div>
          </div>
        </section>

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
