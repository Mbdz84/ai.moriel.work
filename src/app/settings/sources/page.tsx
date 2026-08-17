import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getActiveBusiness, isAdmin } from "@/lib/tenant";
import { listVapiAssistants } from "@/lib/vapi";
import SettingsNav from "@/components/SettingsNav";
import { saveSources } from "./actions";

type SourceRow = { assistant_id: string; label: string };

export default async function SourcesPage({
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

  const assistants = await listVapiAssistants();
  const { data: existing } = await supabase
    .from("sources")
    .select("assistant_id, label")
    .eq("business_id", businessId);
  const labelFor = new Map(
    ((existing ?? []) as SourceRow[]).map((r) => [r.assistant_id, r.label])
  );

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-800">Sources</h1>
        <SettingsNav active="sources" admin={true} />
      </div>

      <p className="text-sm text-neutral-500">
        Give each AI agent a source name. Every call is tagged with its source —
        shown on the dashboard and at the top of the job SMS. Leave a name blank
        to use the agent&apos;s own name.
      </p>

      {saved && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Saved.
        </p>
      )}

      {assistants.length === 0 ? (
        <p className="rounded bg-amber-50 text-amber-700 text-sm px-3 py-2">
          No assistants found. Make sure VAPI_API_KEY is set on the server.
        </p>
      ) : (
        <form action={saveSources} className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm divide-y divide-neutral-200">
            {assistants.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center p-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-neutral-800 truncate">
                    {a.name}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{a.id}</div>
                </div>
                <div className="space-y-1">
                  <label className={label}>Source name</label>
                  <input type="hidden" name="assistant_id" value={a.id} />
                  <input
                    name="label"
                    defaultValue={labelFor.get(a.id) || a.name}
                    placeholder={a.name}
                    className={input}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="submit"
            className="rounded bg-black text-white px-4 py-2 text-sm"
          >
            Save sources
          </button>
        </form>
      )}
    </main>
  );
}
