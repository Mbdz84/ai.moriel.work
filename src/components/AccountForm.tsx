"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function AccountForm() {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErr(error.message);
    else {
      setMsg("Password updated.");
      setPassword("");
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.updateUser({ email });
    if (error) setErr(error.message);
    else setMsg("Check your new email to confirm the change.");
  }

  const input = "w-full rounded border border-neutral-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      {msg && (
        <p className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">
          {msg}
        </p>
      )}
      {err && (
        <p className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{err}</p>
      )}

      <form onSubmit={changePassword} className="space-y-3">
        <h2 className="font-semibold">Change password</h2>
        <input
          type="password"
          required
          minLength={6}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        <button className="rounded bg-black text-white px-4 py-2 text-sm">
          Update password
        </button>
      </form>

      <form onSubmit={changeEmail} className="space-y-3">
        <h2 className="font-semibold">Change email</h2>
        <input
          type="email"
          required
          placeholder="New email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <button className="rounded bg-black text-white px-4 py-2 text-sm">
          Update email
        </button>
      </form>
    </div>
  );
}
