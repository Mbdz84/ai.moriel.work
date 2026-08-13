"use client";

import { useRouter } from "next/navigation";
import type { Membership } from "@/lib/tenant";

// Dropdown to switch the active company. Sets a cookie the server reads,
// then refreshes so every page re-scopes to the chosen tenant.
export default function CompanySwitcher({
  memberships,
  activeId,
}: {
  memberships: Membership[];
  activeId: string;
}) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "__add__") {
      router.push("/setup");
      return;
    }
    document.cookie = `active_business=${value}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <select
      value={activeId}
      onChange={onChange}
      className="text-sm border border-neutral-300 rounded px-2 py-1 bg-white"
    >
      {memberships.map((m) => (
        <option key={m.business_id} value={m.business_id}>
          {m.name} · {m.company_id}
        </option>
      ))}
      <option value="__add__">+ Add company…</option>
    </select>
  );
}
