"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/brand";
import {
  FileTextIcon,
  HelpCircleIcon,
  ShieldIcon,
  ZapIcon,
} from "@/components/ui/icons";

const NAV = [
  { href: "/", label: "Generator", icon: ZapIcon },
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
    <aside className="print-hidden fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-zinc-200 bg-white/70 backdrop-blur md:flex">
      <Link
        href="/"
        className="group flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-200/70 px-4 transition-colors hover:bg-zinc-50"
      >
        <LogoMark size="h-7 w-7" />
        <span className="font-display text-[15px] font-bold tracking-tight text-zinc-900">
          Debrief
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900/[0.05] text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 active:bg-zinc-200/60"
              }`}
            >
              {/* Active rail: an ink notch on the left edge of the item */}
              <span
                aria-hidden="true"
                className={`absolute -left-px top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-blue-700 transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? "text-blue-700"
                    : "text-zinc-400 group-hover:text-zinc-600"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-200/70 p-4">
        <p className="flex items-start gap-2 font-mono text-[10px] leading-relaxed tracking-wide text-zinc-400">
          <ShieldIcon className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
          IN-MEMORY ONLY.
          <br />
          NOTHING IS STORED.
        </p>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <header className="print-hidden sticky top-0 z-30 border-b border-zinc-200 bg-paper/80 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size="h-7 w-7" />
          <span className="font-display text-[15px] font-bold tracking-tight text-zinc-900">
            Debrief
          </span>
        </Link>
        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-400">
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
      className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                active ? "text-zinc-900" : "text-zinc-400 active:text-zinc-600"
              }`}
            >
              {/* Active rail: a notch on the tab's top edge */}
              <span
                aria-hidden="true"
                className={`absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-700 transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-5 w-5 ${active ? "text-blue-700" : ""}`}
              />
              {item.label === "How it works" ? "Guide" : item.label === "Sample report" ? "Sample" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
