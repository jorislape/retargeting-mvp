"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { LogoMark } from "@/components/ui/brand";
import {
  BarChartIcon,
  BellIcon,
  FileTextIcon,
  SettingsIcon,
} from "@/components/ui/icons";

const NAV = [
  { href: "/home", label: "Home", icon: BarChartIcon },
  { href: "/reports", label: "Reports", icon: FileTextIcon },
  { href: "/alerts", label: "Alerts", icon: BellIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

/* Tinted blue = current location (a state, not an action) — same
   affordance rule as the landing page. */
function navLinkClasses(active: boolean) {
  return `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-blue-500/10 text-white"
      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
  }`;
}

function navIconClasses(active: boolean) {
  return `h-4 w-4 shrink-0 transition-colors ${
    active ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300"
  }`;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-white/5 bg-zinc-950 sm:flex">
        {/* h-14 brand band mirrors the landing nav and mobile top-bar */}
        <Link
          href="/home"
          className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/5 px-4"
        >
          <LogoMark size="h-7 w-7" />
          <span className="text-sm font-bold tracking-tight text-white">
            AdReports
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Beta
          </span>
        </Link>

        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={navLinkClasses(active)}
              >
                <item.icon className={navIconClasses(active)} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/5 p-4">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Data synced live from Meta&apos;s Marketing API.
          </p>
        </div>
      </aside>

      <div className="flex-1 sm:pl-56">
        {/* Mobile top-bar: the sidebar is hidden below sm, so this is the
            only nav on phones. Same translucent-blur bar as the landing. */}
        <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur sm:hidden">
          <div className="flex h-14 items-center justify-between px-5">
            <Link
              href="/home"
              className="flex items-center gap-2"
              onClick={() => setMenuOpen(false)}
            >
              <LogoMark size="h-7 w-7" />
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
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
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
              {NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={navLinkClasses(active)}
                  >
                    <item.icon className={navIconClasses(active)} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        <main className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
