import Link from "next/link";

// Sub-navigation for settings. Admin-only tabs render only for admins;
// Account is always available.
export default function SettingsNav({
  active,
  admin,
}: {
  active: "dispatch" | "agent" | "company" | "account";
  admin: boolean;
}) {
  const base = "text-sm px-3 py-1.5 rounded";
  const on = "bg-black text-white";
  const off = "text-neutral-600 hover:bg-neutral-100";
  const item = (key: string) => `${base} ${active === key ? on : off}`;
  return (
    <div className="flex flex-wrap gap-2">
      {admin && (
        <>
          <Link href="/settings" className={item("dispatch")}>
            Dispatch &amp; Twilio
          </Link>
          <Link href="/settings/agent" className={item("agent")}>
            AI Agent
          </Link>
          <Link href="/settings/company" className={item("company")}>
            Company
          </Link>
        </>
      )}
      <Link href="/settings/account" className={item("account")}>
        Account
      </Link>
    </div>
  );
}
