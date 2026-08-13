"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// Company-creation step. Used right after signup and by an existing
// logged-in account adding another company. The account number (company_id)
// is auto-generated server-side.
export default function SetupForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase.rpc("register_company", {
      p_company_name: companyName,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      document.cookie = `active_business=${data}; path=/; max-age=31536000; samesite=lax`;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-sm text-neutral-600">Company name</label>
        <input
          required
          placeholder="Acme Locksmith"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-blue-600 hover:bg-blue-700 text-white py-2 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create company"}
      </button>
    </form>
  );
}
