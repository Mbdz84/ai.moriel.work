"use client";

import { useState } from "react";
import {
  disableAccount,
  enableAccount,
  deleteAccount,
} from "@/app/settings/company/actions";

// Super-admin-only controls for the active company. Disable is a reversible
// lock (no data removed); delete is a permanent cascade guarded by a
// type-the-name confirmation.
export default function DangerZone({
  companyName,
  disabled,
}: {
  companyName: string;
  disabled: boolean;
}) {
  const [confirm, setConfirm] = useState("");
  const canDelete = confirm.trim() === companyName.trim() && companyName.trim() !== "";

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";

  return (
    <section className="space-y-4 rounded-lg border border-rose-300 bg-rose-50/50 p-4">
      <div>
        <h2 className="font-semibold text-rose-700">Danger zone</h2>
        <p className="text-xs text-rose-600/80">
          Super admin only. These controls affect the whole account.
        </p>
      </div>

      {/* Disable / re-enable */}
      {disabled ? (
        <div className="space-y-2">
          <p className="rounded bg-rose-100 text-rose-800 text-sm px-3 py-2">
            This account is currently <strong>disabled</strong>. Its users are
            locked out and its calls are not processed.
          </p>
          <form action={enableAccount}>
            <button className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm">
              Re-enable account
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-1">
          <form action={disableAccount}>
            <button className="rounded bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm">
              Disable this account
            </button>
          </form>
          <p className="text-xs text-neutral-500">
            Reversible. Locks out the company&apos;s users and stops processing
            its calls. Logins and Vapi assistants are kept.
          </p>
        </div>
      )}

      {/* Delete (hard, type-to-confirm) */}
      <div className="space-y-2 border-t border-rose-200 pt-4">
        <p className="text-sm font-medium text-rose-700">Delete account</p>
        <p className="text-xs text-neutral-600">
          Permanently deletes this company and ALL its data — calls, jobs,
          sources, dispatch settings, credentials, and team memberships. Login
          users and Vapi assistants are not touched. This cannot be undone. Type
          the company name <strong>{companyName || "(unnamed)"}</strong> to
          confirm.
        </p>
        <form action={deleteAccount} className="space-y-2">
          <input
            name="confirm_name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={companyName}
            className={input}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!canDelete}
            className="rounded bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 text-sm"
          >
            Permanently delete account
          </button>
        </form>
      </div>
    </section>
  );
}
