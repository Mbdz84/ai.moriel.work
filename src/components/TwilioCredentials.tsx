"use client";

import { useState } from "react";
import { saveTwilio } from "@/app/settings/actions";

// Shows Twilio credentials masked (never sends the real token/SID to the
// browser). "Change credentials" reveals editable inputs.
export default function TwilioCredentials({
  connected,
  sidLast4,
  hasToken,
  fromNumber,
  balance,
}: {
  connected: boolean;
  sidLast4: string | null;
  hasToken: boolean;
  fromNumber: string;
  balance: string | null;
}) {
  const [editing, setEditing] = useState(false);

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";
  const disabled =
    "w-full rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-500";
  const label = "text-sm font-medium text-neutral-700";

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Twilio credentials</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            connected
              ? "bg-green-100 text-green-700"
              : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {connected ? "● Connected" : "Not connected"}
        </span>
      </div>

      {connected && (
        <p className="text-sm text-neutral-600">
          Balance: {balance ?? "—"}
        </p>
      )}

      {!editing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className={label}>Account SID</label>
            <input
              disabled
              className={disabled}
              value={sidLast4 ? `AC••••••••${sidLast4}` : "not set"}
              readOnly
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Auth Token</label>
            <input
              disabled
              className={disabled}
              value={hasToken ? "•••• saved" : "not set"}
              readOnly
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Twilio From Number</label>
            <input disabled className={disabled} value={fromNumber || "not set"} readOnly />
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            Change credentials
          </button>
        </div>
      ) : (
        <form action={saveTwilio} className="space-y-3">
          <div className="space-y-1">
            <label className={label}>Account SID</label>
            <input
              name="twilio_account_sid"
              className={input}
              placeholder="ACxxxxxxxx"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Auth Token</label>
            <input
              name="twilio_auth_token"
              type="password"
              className={input}
              placeholder="new auth token"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <label className={label}>Twilio From Number</label>
            <input
              name="twilio_number"
              className={input}
              defaultValue={fromNumber}
              placeholder="+1..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-black text-white px-4 py-2 text-sm"
            >
              Save credentials
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-neutral-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Leave SID/token blank to keep the existing ones and only update the
            number.
          </p>
        </form>
      )}
    </section>
  );
}
