import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px] font-mono text-neutral-800">
      {children}
    </code>
  );
}

function Block({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[13px] font-mono text-neutral-800 overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

export default async function GuidesPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  const card = "rounded-xl border border-neutral-200 bg-white shadow-sm p-5 space-y-3";
  const h2 = "text-lg font-semibold text-neutral-800";
  const p = "text-sm text-neutral-600";

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Guides</h1>
        <SettingsNav active="guides" admin={true} />
      </div>

      {/* Spam gate */}
      <section className={card}>
        <h2 className={h2}>Twilio “press 1” spam gate → Vapi</h2>
        <p className={p}>
          A Twilio Studio flow answers first and asks the caller to press 1 to be
          connected. Robocallers never press 1, so they’re filtered out{" "}
          <strong>before</strong> the call reaches Vapi — no AI answer, no Vapi
          charge, and (unless you log them, below) nothing on the dashboard.
        </p>

        <Block>{`Caller → Twilio number → Studio flow ("press 1?")
                              ├── pressed 1 → SIP → Vapi assistant → dashboard
                              └── no press  → (optional) log as Spam → dashboard`}</Block>

        <p className={p}>Your assistant’s SIP address:</p>
        <Block>{`sip:noys-locksmiths@sip.vapi.ai`}</Block>

        <h3 className="font-medium text-neutral-800">Setup (in Twilio)</h3>
        <ol className="list-decimal pl-5 text-sm text-neutral-600 space-y-2">
          <li>
            <strong>Point the number at the Studio flow, not Vapi.</strong>{" "}
            Twilio Console → Phone Numbers → your number → Voice → “A call comes
            in” → set it to your Studio Flow (the press‑1 gate).
          </li>
          <li>
            <strong>
              In the flow, change the <Code>connect_call_1</Code> widget
            </strong>{" "}
            from dialing your human line to dialing Vapi:
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Connect To: <strong>SIP</strong></li>
              <li>
                SIP address: <Code>sip:noys-locksmiths@sip.vapi.ai</Code>
              </li>
              <li>
                Caller ID: <Code>{"{{contact.channel.address}}"}</Code> — so Vapi
                receives the real caller number and{" "}
                <Code>{"{{customer.number}}"}</Code> still works.
              </li>
            </ul>
          </li>
          <li>Update the gather text if it still says another business name.</li>
          <li>
            Turn <strong>off</strong> recording in the Studio connect widget —
            Vapi records the call, and that’s what feeds the dashboard.
          </li>
        </ol>
      </section>

      {/* Blocked logging */}
      <section className={card}>
        <h2 className={h2}>Optional: log blocked (spam) callers to the dashboard</h2>
        <p className={p}>
          A caller who never presses 1 never reaches Vapi, so they don’t appear on
          the dashboard. To still see them as <strong>Spam</strong> rows:
        </p>
        <ol className="list-decimal pl-5 text-sm text-neutral-600 space-y-2">
          <li>
            Set an env var on the app:{" "}
            <Code>TWILIO_INGEST_KEY=&lt;a long random secret&gt;</Code>.
          </li>
          <li>
            In the flow’s “didn’t press 1” branch, add a{" "}
            <strong>Make HTTP Request</strong> widget:
          </li>
        </ol>
        <Block>{`Method: POST
URL: https://ai.moriel.work/api/twilio/blocked?key=YOUR_TWILIO_INGEST_KEY
Content-Type: application/json
Body:
{
  "from": "{{contact.channel.address}}",
  "to": "{{trigger.call.To}}"
}`}</Block>
        <p className={p}>
          Each blocked caller then shows on the dashboard as a Spam row (caller
          number, “blocked” status, “no keypress (spam gate)” reason) — no
          recording, no Vapi cost.
        </p>
      </section>

      {/* Notes */}
      <section className={card}>
        <h2 className={h2}>Notes</h2>
        <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1">
          <li>
            Legit callers hear “press 1” first — a small, deliberate trade‑off
            that stops essentially all robocalls.
          </li>
          <li>
            On the rare robocall that does press 1 and reaches Vapi, the agent’s
            spam handling and the dashboard’s Spam flag still catch it.
          </li>
          <li>
            Vapi’s inbound number and the SIP endpoint point to the same
            assistant, so the AI behaves identically once connected.
          </li>
        </ul>
      </section>
    </main>
  );
}
