"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { LogoMark } from "@/components/ui/brand";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/reports", label: "Reports" },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Settings" },
] as const;

/* Tinted blue = current location (a state, not an action) — same
   affordance rule as the landing page. */
const navLinkClasses = (active: boolean) =>
  `rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-blue-500/10 text-white"
      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
  }`;

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-52 flex-col border-r border-white/5 bg-zinc-950 px-3 py-4 sm:flex">
        <Link href="/home" className="flex items-center gap-2 px-2">
          <LogoMark />
          <span className="text-sm font-bold tracking-tight text-white">
            AdReports
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Beta
          </span>
        </Link>

        <nav className="mt-6 flex flex-col gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClasses(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="mt-auto px-2 text-[10px] text-zinc-500">
          Synced live from Meta
        </p>
      </aside>

      <div className="flex-1 sm:pl-52">
        {/* Mobile top-bar: the sidebar is hidden below sm, so this is the
            only nav on phones. Same translucent-blur bar as the landing. */}
        <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur sm:hidden">
          <div className="flex h-14 items-center justify-between px-5">
            <Link
              href="/home"
              className="flex items-center gap-2"
              onClick={() => setMenuOpen(false)}
            >
              <LogoMark />
              <span className="text-sm font-bold tracking-tight text-white">
                AdReports
              </span>
            </Link>
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {menuOpen ? (
                  <>
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>

          {menuOpen && (
            <nav
              id="mobile-nav"
              className="flex flex-col gap-0.5 border-t border-white/5 px-3 py-2"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={navLinkClasses(isActive(item.href))}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
