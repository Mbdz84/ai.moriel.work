import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";
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

  const business = active
    ? { name: active.name, company_id: active.company_id }
    : undefined;

  const { data: cred } = await supabase
    .from("credentials")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  const { data: dispatch } = await supabase
    .from("dispatch_targets")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  const input =
    "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <SettingsNav active="dispatch" admin={true} />
      </div>

      {business && (
        <p className="text-sm text-neutral-500">
          {business.name} · Company ID {business.company_id}
        </p>
      )}

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Settings saved.
        </p>
      )}

      <form action={saveSettings} className="space-y-6">
        <section className="space-y-3">
          <h2 className="font-semibold">Twilio credentials</h2>
          <div className="space-y-1">
            <label className={label}>Account SID</label>
            <input
              name="twilio_account_sid"
              defaultValue={cred?.twilio_account_sid ?? ""}
              placeholder="ACxxxxxxxx"
              className={input}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Auth Token</label>
            <input
              name="twilio_auth_token"
              type="password"
              defaultValue={cred?.twilio_auth_token ?? ""}
              placeholder="your auth token"
              className={input}
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Twilio From Number</label>
            <input
              name="twilio_number"
              defaultValue={cred?.twilio_number ?? ""}
              placeholder="+1..."
              className={input}
            />
          </div>
        </section>

        <section className="space-y-3">
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
            <label className={label}>SMS destination (your phone)</label>
            <input
              name="sms_to"
              defaultValue={dispatch?.sms_to ?? ""}
              placeholder="+12223334444"
              className={input}
            />
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
        </section>

        <button
          type="submit"
          className="rounded bg-black text-white px-4 py-2 text-sm"
        >
          Save settings
        </button>
      </form>
    </main>
  );
}
