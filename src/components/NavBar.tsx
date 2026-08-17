"use client";

import { useState } from "react";
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
  const [balances, setBalances] = useState<{ twilio: string | null } | null>(
    null
  );
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const linkCls = (href: string) =>
    `text-sm font-medium transition-colors ${
      isActive(href)
        ? "text-indigo-600"
        : "text-neutral-600 hover:text-neutral-900"
    }`;

  const close = () => setOpen(false);

  // Open the drawer and lazily fetch the Twilio balance (admins only).
  function openDrawer() {
    setOpen(true);
    if (admin && !balances) {
      fetch("/api/balances")
        .then((r) => r.json())
        .then((d) => setBalances({ twilio: d?.twilio ?? null }))
        .catch(() => setBalances({ twilio: null }));
    }
  }

  const navLinks = (onNav?: () => void) => (
    <>
      <Link href="/dashboard" className={linkCls("/dashboard")} onClick={onNav}>
        Dashboard
      </Link>
      {admin ? (
        <Link href="/settings" className={linkCls("/settings")} onClick={onNav}>
          Settings
        </Link>
      ) : (
        <Link
          href="/settings/account"
          className={linkCls("/settings/account")}
          onClick={onNav}
        >
          Account
        </Link>
      )}
    </>
  );

  const brand = (
    <span className="flex items-center gap-2 font-bold text-neutral-900">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-white text-sm">
        V
      </span>
      Voice-AI
    </span>
  );

  return (
    <header className="border-b border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <nav className="mx-auto max-w-[1100px] flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-6">
          <Link href="/dashboard">{brand}</Link>
          <div className="hidden md:flex items-center gap-5">{navLinks()}</div>
        </div>

        {/* Desktop controls */}
        <div className="hidden md:flex items-center gap-3 text-sm">
          {active?.role === "super" && (
            <span className="rounded-full bg-rose-600 text-white text-xs px-2 py-0.5">
              SUPER
            </span>
          )}
          {active && (
            <CompanySwitcher
              memberships={memberships}
              activeId={active.business_id}
            />
          )}
          <ThemeToggle />
          <LogoutButton />
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 -mr-2 text-neutral-700"
          aria-label="Open menu"
          onClick={openDrawer}
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
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] bg-white shadow-xl p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              {brand}
              <button aria-label="Close menu" onClick={close} className="p-1 text-neutral-700">
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
                    <span className="rounded-full bg-rose-600 text-white text-xs px-2 py-0.5">
                      SUPER
                    </span>
                  )}
                  <p className="text-sm text-neutral-500">
                    {active.name} · {active.company_id}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 text-base">{navLinks(close)}</div>

            {/* Bottom: balances (admin) + theme/logout */}
            <div className="mt-auto space-y-3">
              {admin && (
                <div className="rounded-lg border border-neutral-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Twilio balance</span>
                    <span className="font-medium">
                      {balances ? balances.twilio ?? "—" : "…"}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
