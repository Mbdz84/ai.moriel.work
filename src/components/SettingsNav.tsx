import Link from "next/link";

// Sub-navigation shared by the settings pages.
export default function SettingsNav({ active }: { active: "dispatch" | "agent" }) {
  const base = "text-sm px-3 py-1.5 rounded";
  const on = "bg-black text-white";
  const off = "text-neutral-600 hover:bg-neutral-100";
  return (
    <div className="flex gap-2">
      <Link
        href="/settings"
        className={`${base} ${active === "dispatch" ? on : off}`}
      >
        Dispatch &amp; Twilio
      </Link>
      <Link
        href="/settings/agent"
        className={`${base} ${active === "agent" ? on : off}`}
      >
        AI Agent
      </Link>
    </div>
  );
}
