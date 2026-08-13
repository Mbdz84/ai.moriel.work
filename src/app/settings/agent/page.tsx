import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";
import { saveAgent } from "./actions";

// Sensible starting content (from the user's dispatcher prompt), shown when
// a field hasn't been saved yet. Edit freely in the UI.
const DEFAULTS = {
  greeting: "Locksmith service, how can I help you today?",
  persona: `You are a professional voice dispatcher for "pro car keys". Your role is to collect the caller's information politely and efficiently to dispatch a technician for locksmith service.

Tone & behavior: calm, confident, professional. Speak naturally and as human as possible — never robotic. Keep the call efficient and avoid repeating confirmations. If the caller already confirmed something (name, address, callback number), don't ask again unless they correct it. If background noise is loud, focus on the main caller's voice. Never say you're an AI — stay in the role of a real dispatcher. If the caller goes silent for ~12 seconds, ask once "Are you still there?".`,
  ask_questions: `1. Identify the service type (car lockout, house lockout, car key replacement, ignition repair, lock change). If it's a vehicle, ask for the year, make, and model.
2. Say: "I'll just need a few quick details to dispatch a technician."
3. Collect once only:
   - Name (wait for the caller's name)
   - Address (get street, city, and ZIP if missing)
   - Best callback phone number
4. Confirm briefly if not already done: "So that's [job type] at [address], and the best callback is [phone]."
5. Ending: "Perfect! I have everything I need and I'm dispatching the closest technician. They'll call you shortly with the estimate and ETA. If there's nothing else, you can hang up. Thank you for calling, goodbye."

Repeat callers: if they say "I already called" or "no one called me back", don't re-collect details — say "I'll have the technician call you right now with an updated ETA." If the caller hangs up mid-sentence, end politely: "Thank you, goodbye."`,
  out_of_scope: "",
};

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

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  const { data: agent } = await supabase
    .from("agents")
    .select("vapi_assistant_id, greeting, persona, ask_questions, out_of_scope")
    .eq("business_id", businessId)
    .maybeSingle();

  const val = (k: keyof typeof DEFAULTS) =>
    (agent?.[k] as string | null) || DEFAULTS[k];

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";
  const area = `${input} min-h-32`;

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Agent</h1>
        <SettingsNav active="agent" admin={true} />
      </div>

      <p className="text-sm text-neutral-500">
        Fill in these fields; on save they&apos;re combined into the agent&apos;s
        instructions and pushed to Vapi.
      </p>

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Saved.{" "}
          {sync === "ok" && "Synced to Vapi — live on your next call."}
          {sync === "failed" &&
            "But the Vapi sync failed (check the Assistant ID / VAPI_API_KEY). Your edits are saved."}
          {sync === "skipped" &&
            "Add your Vapi Assistant ID to push changes to the live agent."}
        </p>
      )}

      <form action={saveAgent} className="space-y-6">
        <div className="space-y-1">
          <label className={label}>Vapi Assistant ID</label>
          <input
            name="vapi_assistant_id"
            defaultValue={agent?.vapi_assistant_id ?? ""}
            placeholder="from dashboard.vapi.ai/assistants/<ID>"
            className={input}
          />
        </div>

        <div className="space-y-1">
          <label className={label}>What to say first (greeting)</label>
          <textarea name="greeting" defaultValue={val("greeting")} className={area} />
        </div>

        <div className="space-y-1">
          <label className={label}>Who we are</label>
          <textarea name="persona" defaultValue={val("persona")} className={`${area} min-h-40`} />
          <p className="text-xs text-neutral-500">
            The role, company, tone, and behavior of the agent.
          </p>
        </div>

        <div className="space-y-1">
          <label className={label}>What the agent asks / collects</label>
          <textarea
            name="ask_questions"
            defaultValue={val("ask_questions")}
            className={`${area} min-h-48`}
          />
          <p className="text-xs text-neutral-500">
            The questions and steps, in order.
          </p>
        </div>

        <div className="space-y-1">
          <label className={label}>What we don&apos;t do</label>
          <textarea
            name="out_of_scope"
            defaultValue={val("out_of_scope")}
            className={area}
            placeholder="e.g. aircraft/helicopter keys, safes we don't service — the agent politely declines these"
          />
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
