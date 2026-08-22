"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";

// Save per-source config. Each source (a Vapi assistant) carries its own
// brand label, agent name, outbound number, extra recipients, caller-SMS
// link, and spam-notify preference. Fields are keyed by assistant id
// ("field::<id>") so rows never misalign; extra numbers are collected with
// getAll (a dynamic list of inputs sharing one name).
export async function saveSources(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId || !isAdmin(active?.role)) redirect("/dashboard");

  const ids = formData.getAll("assistant_id").map((v) => String(v)).filter(Boolean);
  const get = (field: string, id: string) =>
    String(formData.get(`${field}::${id}`) ?? "").trim();
  const bool = (field: string, id: string) =>
    formData.get(`${field}::${id}`) === "on";
  const numbers = (id: string) =>
    formData
      .getAll(`extra_sms_to::${id}`)
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join(", ");

  const rows = ids.map((assistant_id) => ({
    business_id: businessId,
    assistant_id,
    provider: get("provider", assistant_id) === "11labs" ? "11labs" : "vapi",
    label: get("label", assistant_id),
    agent_name: get("agent_name", assistant_id) || null,
    from_number: get("from_number", assistant_id) || null,
    extra_sms_to: numbers(assistant_id),
    extra_json_url: get("extra_json_url", assistant_id),
    exclude_from_global: bool("exclude_from_global", assistant_id),
    notify_spam: bool("notify_spam", assistant_id),
    caller_sms_enabled: bool("caller_sms_enabled", assistant_id),
    caller_link: get("caller_link", assistant_id),
    caller_link_label: get("caller_link_label", assistant_id),
    caller_sms_template: get("caller_sms_template", assistant_id),
  }));

  if (rows.length) {
    await supabase
      .from("sources")
      .upsert(rows, { onConflict: "business_id,assistant_id" });
  }

  redirect("/settings/sources?saved=1");
}
