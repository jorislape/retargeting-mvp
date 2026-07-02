"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-dvh bg-zinc-950 text-zinc-100 antialiased">
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

      {/* min-w-0 keeps wide page content (tables, pill rows) scrolling
          inside its own container instead of stretching the whole pane */}
      <div className="min-w-0 flex-1 sm:pl-56">
        {/* Mobile top-bar: brand only. Navigation lives in the bottom tab
            bar — one tap to anywhere, no hamburger round-trip. */}
        <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur sm:hidden">
          <div className="flex h-14 items-center px-5">
            <Link href="/home" className="flex items-center gap-2">
              <LogoMark size="h-7 w-7" />
              <span className="text-sm font-bold tracking-tight text-white">
                AdReports
              </span>
            </Link>
          </div>
        </header>

        {/* pb-24 reserves space for the fixed bottom tab bar on mobile */}
        <main className="mx-auto max-w-6xl px-5 py-6 pb-24 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar — top-level destinations, 44pt+ targets,
          safe-area padding for gesture-nav devices. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                  active ? "text-white" : "text-zinc-500 active:text-zinc-300"
                }`}
              >
                <item.icon
                  className={`h-5 w-5 ${active ? "text-blue-400" : ""}`}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
