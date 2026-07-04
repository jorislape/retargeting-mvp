"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui/brand";
import {
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  ShieldIcon,
  ZapIcon,
} from "@/components/ui/icons";

const NAV = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/generator", label: "Generator", icon: ZapIcon },
  { href: "/sample", label: "Sample report", icon: FileTextIcon },
  { href: "/how-it-works", label: "How it works", icon: HelpCircleIcon },
  { href: "/privacy", label: "Privacy", icon: ShieldIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="print-hidden fixed inset-y-0 left-0 z-20 hidden w-52 flex-col border-r border-white/[0.06] bg-carbon md:flex">
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center px-4 transition-opacity hover:opacity-80"
      >
        <Wordmark />
      </Link>

      <nav className="flex flex-col gap-1 px-3 pt-2">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-white/[0.06] text-white"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              }`}
            >
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? "text-accent-soft"
                    : "text-zinc-600 group-hover:text-zinc-400"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.06] p-4">
        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-600">
          <ShieldIcon className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
          In-memory only.
          <br />
          Nothing is stored.
        </p>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <header className="print-hidden sticky top-0 z-30 border-b border-white/[0.06] bg-carbon/90 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/" className="flex items-center">
          <Wordmark />
        </Link>
        <span className="text-[10px] font-medium text-zinc-600">
          Nothing stored
        </span>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-carbon/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                active ? "text-zinc-100" : "text-zinc-500 active:text-zinc-300"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute -top-px left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-accent transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-5 w-5 ${active ? "text-accent-soft" : ""}`}
              />
              {item.label === "How it works" ? "Guide" : item.label === "Sample report" ? "Sample" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
