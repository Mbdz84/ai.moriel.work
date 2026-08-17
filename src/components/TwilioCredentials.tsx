"use client";

import { useState } from "react";
import { saveTwilio } from "@/app/settings/actions";

// Twilio credentials via an API Key (Key SID + Secret) — the secure option.
// Secrets are never sent to the browser; only masked hints are shown.
export default function TwilioCredentials({
  connected,
  sidLast4,
  keyLast4,
  hasKey,
  hasLegacyToken,
  fromNumber,
  balance,
}: {
  connected: boolean;
  sidLast4: string | null;
  keyLast4: string | null;
  hasKey: boolean;
  hasLegacyToken: boolean;
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
        <p className="text-sm text-neutral-600">Balance: {balance ?? "—"}</p>
      )}

      {hasLegacyToken && !hasKey && (
        <p className="rounded bg-amber-50 text-amber-700 text-xs px-3 py-2">
          Using a legacy Auth Token. Add an API Key below for better security —
          it can be revoked on its own without touching your account.
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
            <label className={label}>API Key</label>
            <input
              disabled
              className={disabled}
              value={
                hasKey ? `SK••••••••${keyLast4 ?? ""} · secret saved` : "not set"
              }
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
            <label className={label}>API Key SID</label>
            <input
              name="twilio_api_key_sid"
              className={input}
              placeholder="SKxxxxxxxx"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <label className={label}>API Key Secret</label>
            <input
              name="twilio_api_key_secret"
              type="password"
              className={input}
              placeholder="API key secret"
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
            Create a key in Twilio Console → Account → API keys &amp; tokens →
            Create API key. Paste the Key SID (SK…) and Secret here. Blank fields
            keep the existing values.
          </p>
        </form>
      )}
    </section>
  );
}
