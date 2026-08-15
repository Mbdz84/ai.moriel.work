import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";
import SmsTemplateEditor from "@/components/SmsTemplateEditor";
import { DEFAULT_SMS_TEMPLATE } from "@/lib/sms-template";
import { saveSmsTemplate } from "./actions";

export default async function SmsSettingsPage({
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

  const { data: dispatch } = await supabase
    .from("dispatch_targets")
    .select("sms_template")
    .eq("business_id", businessId)
    .maybeSingle();

  const template =
    (dispatch?.sms_template as string | null)?.trim() || DEFAULT_SMS_TEMPLATE;

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">SMS</h1>
        <SettingsNav active="sms" admin={true} />
      </div>

      <p className="text-sm text-neutral-500">
        Customize the text message sent to your team when the agent captures a
        job. Insert tokens with the chips below — any line whose fields are all
        empty is dropped automatically.
      </p>

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Saved.
        </p>
      )}

      <form action={saveSmsTemplate} className="space-y-4">
        <SmsTemplateEditor
          initial={template}
          businessName={active?.name ?? "Your Company"}
        />
        <button
          type="submit"
          className="rounded bg-black text-white px-4 py-2 text-sm"
        >
          Save SMS template
        </button>
      </form>
    </main>
  );
}
