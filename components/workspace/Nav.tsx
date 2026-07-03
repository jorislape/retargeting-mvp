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
    <aside className="print-hidden fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-white/[0.08] bg-gradient-to-b from-[#0d1322]/90 to-[#0a0e1a]/90 shadow-[inset_-1px_0_0_rgba(164,196,255,0.04)] backdrop-blur md:flex">
      <Link
        href="/"
        className="group flex h-14 shrink-0 items-center gap-2.5 border-b border-white/5 px-4 transition-colors hover:bg-white/[0.03]"
      >
        <LogoMark size="h-7 w-7" />
        <span className="font-display text-[15px] font-bold tracking-tight text-white">
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
                  ? "bg-blue-500/10 text-white shadow-[inset_0_1px_0_rgba(147,197,253,0.10)]"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 active:bg-white/[0.07]"
              }`}
            >
              {/* Active rail: a lit notch on the left edge of the item */}
              <span
                aria-hidden="true"
                className={`absolute -left-px top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)] transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? "text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]"
                    : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/5 p-4">
        <p className="flex items-start gap-2 font-mono text-[10px] leading-relaxed tracking-wide text-zinc-600">
          <ShieldIcon className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600" />
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
    <header className="print-hidden sticky top-0 z-30 border-b border-white/[0.07] bg-ink/75 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size="h-7 w-7" />
          <span className="font-display text-[15px] font-bold tracking-tight text-white">
            Debrief
          </span>
        </Link>
        <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
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
      className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/85 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
                active ? "text-white" : "text-zinc-500 active:text-zinc-300"
              }`}
            >
              {/* Active rail: a lit notch on the tab's top edge */}
              <span
                aria-hidden="true"
                className={`absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)] transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-5 w-5 ${
                  active
                    ? "text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]"
                    : ""
                }`}
              />
              {item.label === "How it works" ? "Guide" : item.label === "Sample report" ? "Sample" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
