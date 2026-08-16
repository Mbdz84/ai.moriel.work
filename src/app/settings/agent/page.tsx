import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { listVoices } from "@/lib/voices";
import type { BusinessHours } from "@/lib/hours";
import type { Faq, CollectField } from "@/lib/agent-prompt";
import SettingsNav from "@/components/SettingsNav";
import GreetingField from "@/components/GreetingField";
import VoicePicker from "@/components/VoicePicker";
import BusinessHoursEditor from "@/components/BusinessHoursEditor";
import FaqEditor from "@/components/FaqEditor";
import CollectFieldsEditor from "@/components/CollectFieldsEditor";
import TestCall from "@/components/TestCall";
import { saveAgent } from "./actions";

// Sensible starting content, shown when a field hasn't been saved yet.
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
5. Ending: "Perfect! I have everything I need and I'm dispatching the closest technician. They'll call you shortly with the estimate and ETA. If there's nothing else, you can hang up. Thank you for calling, goodbye."`,
  spam_handling: `If the call is a robocall, telemarketer, or clearly not a customer (silence, dead air, a sales pitch), politely say we're not interested and end the call. Do not collect details or dispatch a technician.`,
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
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  const voices = await listVoices();
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "";

  const strv = (k: string, dflt = "") =>
    (agent?.[k] as string | null)?.trim() || dflt;

  const businessHours = (agent?.business_hours as BusinessHours) ?? {};
  const faqs = (agent?.faqs as Faq[]) ?? [];
  const collectFields = (agent?.collect_fields as CollectField[]) ?? [];
  const displayName = strv("display_name");
  const assistantId = strv("vapi_assistant_id");

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";
  const area = `${input} min-h-32`;
  const section = "space-y-3 rounded-lg border border-neutral-200 p-4";
  const h2 = "font-semibold";

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
        {/* Connection + test */}
        <div className={section}>
          <h2 className={h2}>Connection</h2>
          <div className="space-y-1">
            <label className={label}>Vapi Assistant ID</label>
            <input
              name="vapi_assistant_id"
              defaultValue={assistantId}
              placeholder="from dashboard.vapi.ai/assistants/<ID>"
              className={input}
            />
          </div>
          <TestCall assistantId={assistantId} publicKey={publicKey} />
        </div>

        {/* Identity + greeting */}
        <div className={section}>
          <h2 className={h2}>Identity &amp; greeting</h2>
          <div className="space-y-1">
            <label className={label}>Agent display name</label>
            <input
              name="display_name"
              defaultValue={displayName}
              placeholder="e.g. Dispatcher"
              className={input}
            />
            <p className="text-xs text-neutral-500">
              Used in the greeting and SMS via the{" "}
              <span className="font-mono">{"{agent}"}</span> token.
            </p>
          </div>
          <div className="space-y-1">
            <label className={label}>What to say first (greeting)</label>
            <GreetingField
              initial={strv("greeting", DEFAULTS.greeting)}
              businessName={active?.name ?? ""}
              agentName={displayName}
            />
          </div>
        </div>

        {/* Voice */}
        <div className={section}>
          <h2 className={h2}>Voice</h2>
          <VoicePicker
            voices={voices}
            initialId={strv("voice_id")}
            initialProvider={strv("voice_provider", "11labs")}
          />
        </div>

        {/* Persona */}
        <div className={section}>
          <h2 className={h2}>Who we are</h2>
          <textarea
            name="persona"
            defaultValue={strv("persona", DEFAULTS.persona)}
            className={`${area} min-h-40`}
          />
          <p className="text-xs text-neutral-500">
            The role, company, tone, and behavior of the agent.
          </p>
        </div>

        {/* What to ask + structured details */}
        <div className={section}>
          <h2 className={h2}>What the agent asks / collects</h2>
          <textarea
            name="ask_questions"
            defaultValue={strv("ask_questions", DEFAULTS.ask_questions)}
            className={`${area} min-h-48`}
          />
          <p className="text-xs text-neutral-500">The questions and steps, in order.</p>
          <div className="pt-2">
            <label className={label}>Details to collect (checklist)</label>
            <p className="text-xs text-neutral-500 mb-2">
              The agent makes sure it has each of these before ending the call.
            </p>
            <CollectFieldsEditor initial={collectFields} />
          </div>
        </div>

        {/* FAQ */}
        <div className={section}>
          <h2 className={h2}>Frequently asked questions</h2>
          <p className="text-xs text-neutral-500">
            Canned answers the agent can give callers.
          </p>
          <FaqEditor initial={faqs} />
        </div>

        {/* Hours */}
        <div className={section}>
          <h2 className={h2}>Business hours &amp; after-hours</h2>
          <BusinessHoursEditor
            initial={businessHours}
            enabled={Boolean(agent?.hours_enabled)}
            timezone={strv("timezone", "America/Chicago")}
            afterHours={strv("after_hours_prompt")}
          />
        </div>

        {/* Spam handling */}
        <div className={section}>
          <h2 className={h2}>Spam &amp; robocalls</h2>
          <textarea
            name="spam_handling"
            defaultValue={strv("spam_handling", DEFAULTS.spam_handling)}
            className={area}
          />
        </div>

        {/* Out of scope */}
        <div className={section}>
          <h2 className={h2}>What we don&apos;t do</h2>
          <textarea
            name="out_of_scope"
            defaultValue={strv("out_of_scope")}
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
