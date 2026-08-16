"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Membership } from "@/lib/tenant";
import LogoutButton from "@/components/LogoutButton";
import CompanySwitcher from "@/components/CompanySwitcher";
import ThemeToggle from "@/components/ThemeToggle";

type Active = {
  business_id: string;
  name: string;
  company_id: string;
  role: string;
} | null;

export default function NavBar({
  admin,
  active,
  memberships,
}: {
  admin: boolean;
  active: Active;
  memberships: Membership[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation.
  useEffect(() => setOpen(false), [pathname]);

  const links = (
    <>
      <Link href="/dashboard" className="text-neutral-600 hover:text-black">
        Dashboard
      </Link>
      {admin ? (
        <Link href="/settings" className="text-neutral-600 hover:text-black">
          Settings
        </Link>
      ) : (
        <Link
          href="/settings/account"
          className="text-neutral-600 hover:text-black"
        >
          Account
        </Link>
      )}
    </>
  );

  const controls = (
    <>
      {active?.role === "super" && (
        <span className="rounded bg-red-600 text-white text-xs px-2 py-0.5">
          SUPER
        </span>
      )}
      {active && (
        <CompanySwitcher memberships={memberships} activeId={active.business_id} />
      )}
      <ThemeToggle />
      <LogoutButton />
    </>
  );

  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto max-w-[1100px] flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold">
            Voice-AI
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm">{links}</div>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center gap-4 text-sm">{controls}</div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 -mr-2"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-white shadow-xl p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="font-bold">Voice-AI</span>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="p-1"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>

            {active && (
              <div className="flex flex-col gap-2">
                <CompanySwitcher
                  memberships={memberships}
                  activeId={active.business_id}
                />
                <div className="flex items-center gap-2">
                  {active.role === "super" && (
                    <span className="rounded bg-red-600 text-white text-xs px-2 py-0.5">
                      SUPER
                    </span>
                  )}
                  <p className="text-sm text-neutral-500">
                    {active.name} · {active.company_id}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 text-base">{links}</div>

            <div className="mt-auto flex items-center gap-3">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
