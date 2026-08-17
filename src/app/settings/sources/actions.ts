"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";

// Save a source label per assistant. Blank label = fall back to the assistant
// name at call time. Paired by index: assistant_id[i] <-> label[i].
export async function saveSources(formData: FormData) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId || !isAdmin(active?.role)) redirect("/dashboard");

  const ids = formData.getAll("assistant_id").map((v) => String(v));
  const labels = formData.getAll("label").map((v) => String(v).trim());

  const rows = ids
    .map((assistant_id, i) => ({
      business_id: businessId,
      assistant_id,
      label: labels[i] ?? "",
    }))
    .filter((r) => r.assistant_id);

  if (rows.length) {
    await supabase
      .from("sources")
      .upsert(rows, { onConflict: "business_id,assistant_id" });
  }

  redirect("/settings/sources?saved=1");
}
