import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { getTwilioBalance } from "@/lib/twilio";
import SettingsNav from "@/components/SettingsNav";
import TwilioCredentials from "@/components/TwilioCredentials";
import SmsRecipients from "@/components/SmsRecipients";
import { saveSettings } from "./actions";

export default async function SettingsPage({
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

  const { data: cred } = await supabase
    .from("credentials")
    .select("twilio_account_sid, twilio_auth_token, twilio_number")
    .eq("business_id", businessId)
    .maybeSingle();

  const { data: dispatch } = await supabase
    .from("dispatch_targets")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  // Compute masked values server-side — the real SID/token never reach the client.
  const sid = (cred?.twilio_account_sid as string | null) || "";
  const token = (cred?.twilio_auth_token as string | null) || "";
  const connected = Boolean(sid && token);
  const balance = connected ? await getTwilioBalance(sid, token) : null;

  const smsNumbers = String(dispatch?.sms_to ?? "")
    .split(/[,\n;]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";

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

      <TwilioCredentials
        connected={connected}
        sidLast4={sid ? sid.slice(-4) : null}
        hasToken={Boolean(token)}
        fromNumber={(cred?.twilio_number as string | null) ?? ""}
        balance={balance}
      />

      <form action={saveSettings} className="space-y-4">
        <h2 className="font-semibold">Dispatch</h2>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="sms_enabled"
            defaultChecked={dispatch?.sms_enabled ?? true}
          />
          Send job SMS on call end
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

        <button
          type="submit"
          className="rounded bg-black text-white px-4 py-2 text-sm"
        >
          Save dispatch settings
        </button>
      </form>
    </main>
  );
}
