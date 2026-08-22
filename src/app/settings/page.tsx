import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { getTwilioBalance, twilioConnected } from "@/lib/twilio";
import SettingsNav from "@/components/SettingsNav";
import TwilioCredentials from "@/components/TwilioCredentials";
import SmsRecipients from "@/components/SmsRecipients";
import { saveSettings, purgeRecordingsNow } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; purged?: string }>;
}) {
  const { saved, purged } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  const { data: cred } = await supabase
    .from("credentials")
    .select(
      "twilio_account_sid, twilio_api_key_sid, twilio_api_key_secret, twilio_auth_token, twilio_number"
    )
    .eq("business_id", businessId)
    .maybeSingle();

  const { data: dispatch } = await supabase
    .from("dispatch_targets")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();


  // Compute masked values server-side — real secrets never reach the client.
  const sid = (cred?.twilio_account_sid as string | null) || "";
  const keySid = (cred?.twilio_api_key_sid as string | null) || "";
  const keySecret = (cred?.twilio_api_key_secret as string | null) || "";
  const token = (cred?.twilio_auth_token as string | null) || "";
  const creds = { accountSid: sid, keySid, keySecret, authToken: token };
  const connected = twilioConnected(creds);
  const balance = connected ? await getTwilioBalance(creds) : null;

  const smsNumbers = String(dispatch?.sms_to ?? "")
    .split(/[,\n;]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";
  const section = "space-y-3 rounded-lg border border-neutral-200 p-4";

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <SettingsNav active="dispatch" admin={true} />
      </div>

      {active && (
        <p className="text-sm text-neutral-500">
          {active.name} · Company ID {active.company_id}
        </p>
      )}

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Saved.
        </p>
      )}
      {purged !== undefined && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Removed recordings from {purged} call{purged === "1" ? "" : "s"}.
        </p>
      )}

      <TwilioCredentials
        connected={connected}
        sidLast4={sid ? sid.slice(-4) : null}
        keyLast4={keySid ? keySid.slice(-4) : null}
        hasKey={Boolean(keySid && keySecret)}
        hasLegacyToken={Boolean(token)}
        fromNumber={(cred?.twilio_number as string | null) ?? ""}
        balance={balance}
      />

      <form action={saveSettings} className="space-y-6">
        {/* Team dispatch */}
        <div className={section}>
          <h2 className="font-semibold">Team dispatch</h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sms_enabled"
              defaultChecked={dispatch?.sms_enabled ?? true}
            />
            Send job SMS to your team on call end
          </label>

          <div className="space-y-1">
            <label className={label}>SMS recipients</label>
            <SmsRecipients initial={smsNumbers} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="json_enabled"
              defaultChecked={dispatch?.json_enabled ?? false}
            />
            Also POST job as JSON to a custom URL
          </label>
          <div className="space-y-1">
            <label className={label}>Custom JSON endpoint</label>
            <input
              name="json_url"
              defaultValue={dispatch?.json_url ?? ""}
              placeholder="https://your-crm.example.com/webhook"
              className={input}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Texting the caller a link and spam-call notifications are configured
            per source under{" "}
            <a href="/settings/sources" className="underline">
              Sources
            </a>
            .
          </p>
        </div>

        {/* Email summaries */}
        <div className={section}>
          <h2 className="font-semibold">Email call summaries</h2>
          <p className="text-xs text-neutral-500">
            Emails a summary of each captured job (needs RESEND_API_KEY +
            EMAIL_FROM configured on the server).
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="email_enabled"
              defaultChecked={dispatch?.email_enabled ?? false}
            />
            Email a summary after each call
          </label>
          <div className="space-y-1">
            <label className={label}>Send to</label>
            <input
              name="email_to"
              defaultValue={dispatch?.email_to ?? ""}
              placeholder="name@example.com, second@example.com"
              className={input}
            />
          </div>
        </div>

        <button
          type="submit"
          className="rounded bg-black text-white px-4 py-2 text-sm"
        >
          Save settings
        </button>
      </form>

      {/* Delete old recordings — manual only */}
      <form action={purgeRecordingsNow} className={section}>
        <h2 className="font-semibold">Delete old recordings</h2>
        <p className="text-xs text-neutral-500">
          Removes the audio from calls older than the selected age. Transcripts
          and job details are kept. This runs only when you click — nothing is
          deleted automatically.
        </p>
        <div className="flex items-center gap-2">
          <select
            name="older_than_days"
            defaultValue="90"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="30">Older than 30 days</option>
            <option value="60">Older than 60 days</option>
            <option value="90">Older than 90 days</option>
            <option value="120">Older than 120 days</option>
          </select>
          <button
            type="submit"
            className="rounded bg-black text-white px-4 py-2 text-sm"
          >
            Delete recordings now
          </button>
        </div>
      </form>
    </main>
  );
}
