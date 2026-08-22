import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveBusiness, isAdmin, isSuperAdmin } from "@/lib/tenant";
import SettingsNav from "@/components/SettingsNav";
import AccountForm from "@/components/AccountForm";
import DangerZone from "@/components/DangerZone";
import DeleteLoginButton from "@/components/DeleteLoginButton";
import { updateCompany, addUser, removeUser } from "./actions";

type Member = { user_id: string; role: string; email: string };

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; msg?: string }>;
}) {
  const { saved, msg } = await searchParams;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { businessId, active } = await getActiveBusiness(supabase);
  if (!businessId) redirect("/dashboard");
  if (!isAdmin(active?.role)) redirect("/dashboard");

  const superAdmin = await isSuperAdmin(supabase);

  const { data: members } = await supabase.rpc("get_company_members", {
    b: businessId,
  });
  const team = (members ?? []) as Member[];

  // Which team members are platform super admins (super_admins is service-role
  // only). Shown to super-admin viewers.
  let superIds = new Set<string>();
  if (superAdmin && team.length) {
    const admin = createSupabaseAdmin();
    const { data: sa } = await admin
      .from("super_admins")
      .select("user_id")
      .in(
        "user_id",
        team.map((m) => m.user_id)
      );
    superIds = new Set((sa ?? []).map((r) => r.user_id as string));
  }

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const label = "text-sm font-medium text-neutral-700";

  return (
    <main className="mx-auto w-full max-w-[1100px] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company</h1>
        <SettingsNav active="company" admin={true} />
      </div>

      {active?.disabled && (
        <p className="rounded bg-rose-100 text-rose-800 text-sm px-3 py-2">
          This account is <strong>disabled</strong>.
          {superAdmin
            ? " Re-enable it in the Danger zone below."
            : " Contact your administrator."}
        </p>
      )}

      {saved === "1" && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Company details saved.
        </p>
      )}
      {saved === "user" && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          User added.
        </p>
      )}
      {saved === "removed" && (
        <p className="rounded bg-neutral-100 text-neutral-700 text-sm px-3 py-2">
          User removed.
        </p>
      )}
      {saved === "login_deleted" && (
        <p className="rounded bg-rose-50 text-rose-700 text-sm px-3 py-2">
          Login permanently deleted.
        </p>
      )}
      {saved === "disabled" && (
        <p className="rounded bg-amber-50 text-amber-700 text-sm px-3 py-2">
          Account disabled.
        </p>
      )}
      {saved === "enabled" && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          Account re-enabled.
        </p>
      )}
      {saved === "err" && (
        <p className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">
          {msg || "Something went wrong."}
        </p>
      )}

      {/* Company details */}
      <section className="space-y-3">
        <h2 className="font-semibold">Details</h2>
        <form action={updateCompany} className="space-y-3">
          <div className="space-y-1">
            <label className={label}>Company name</label>
            <input name="name" defaultValue={active?.name ?? ""} className={input} />
          </div>
          <div className="space-y-1">
            <label className={label}>Account number</label>
            <input
              name="company_id"
              defaultValue={active?.company_id ?? ""}
              className={input}
            />
          </div>
          <button
            type="submit"
            className="rounded bg-black text-white px-4 py-2 text-sm"
          >
            Save details
          </button>
        </form>
      </section>

      {/* Team */}
      <section className="space-y-3">
        <h2 className="font-semibold">Team</h2>
        <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
          {team.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>{m.email}</span>
              <span className="flex items-center gap-3">
                {superIds.has(m.user_id) && (
                  <span className="rounded-full bg-rose-600 text-white text-xs font-medium px-2 py-0.5">
                    super admin
                  </span>
                )}
                <span className="text-neutral-500">{m.role}</span>
                {(superAdmin || m.user_id !== user.id) && (
                  <form action={removeUser}>
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <button className="text-neutral-600 hover:underline">
                      Remove
                    </button>
                  </form>
                )}
                {superAdmin && (
                  <DeleteLoginButton userId={m.user_id} email={m.email} />
                )}
              </span>
            </li>
          ))}
        </ul>

        <form
          action={addUser}
          className="space-y-3 rounded border border-neutral-200 p-3"
        >
          <h3 className="text-sm font-medium">Add user</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="email"
              className={input}
            />
            <input
              name="password"
              type="text"
              required
              minLength={6}
              placeholder="temp password"
              className={input}
            />
            <select name="role" defaultValue="viewer" className={input}>
              <option value="viewer">Viewer (dashboard only)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
          >
            Add user
          </button>
          <p className="text-xs text-neutral-500">
            They log in with this email + temp password and can change it under
            Account.
          </p>
        </form>
      </section>

      {/* Your login (moved here from the Account tab) */}
      <section className="space-y-3">
        <h2 className="font-semibold">Your login</h2>
        <p className="text-sm text-neutral-500">{user.email}</p>
        <div className="max-w-md">
          <AccountForm />
        </div>
      </section>

      {/* Danger zone — super admin only */}
      {superAdmin && (
        <DangerZone
          companyName={active?.name ?? ""}
          disabled={Boolean(active?.disabled)}
        />
      )}
    </main>
  );
}
