import Link from "next/link";

// Sub-navigation for settings. Admin-only tabs render only for admins.
// For admins, personal login settings live inside the Company tab, so the
// Account link is shown only to non-admin viewers (their one settings page).
export default function SettingsNav({
  active,
  admin,
}: {
  active:
    | "dispatch"
    | "sms"
    | "sources"
    | "company"
    | "usage"
    | "guides"
    | "account";
  admin: boolean;
}) {
  const base = "text-sm px-3 py-1.5 rounded";
  const on = "bg-black text-white";
  const off = "text-neutral-600 hover:bg-neutral-100";
  const item = (key: string) => `${base} ${active === key ? on : off}`;
  return (
    <div className="flex flex-wrap gap-2">
      {admin ? (
        <>
          <Link href="/settings" className={item("dispatch")}>
            Dispatch &amp; Twilio
          </Link>
          <Link href="/settings/sms" className={item("sms")}>
            SMS
          </Link>
          <Link href="/settings/sources" className={item("sources")}>
            Sources
          </Link>
          <Link href="/settings/company" className={item("company")}>
            Company
          </Link>
          <Link href="/settings/usage" className={item("usage")}>
            Usage
          </Link>
          <Link href="/settings/guides" className={item("guides")}>
            Guides
          </Link>
        </>
      ) : (
        <Link href="/settings/account" className={item("account")}>
          Account
        </Link>
      )}
    </div>
  );
}
