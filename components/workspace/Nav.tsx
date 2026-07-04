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
    <aside className="print-hidden fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-white/[0.07] bg-gradient-to-b from-[#141318]/95 to-[#0a0a0c]/95 backdrop-blur md:flex">
      <Link
        href="/"
        className="group flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4 transition-colors hover:bg-white/[0.03]"
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
                  ? "bg-fuchsia-400/[0.08] text-white shadow-[inset_0_1px_0_rgba(240,171,252,0.08)]"
                  : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-200 active:bg-white/[0.06]"
              }`}
            >
              {/* Active rail: a lit signal notch on the item's left edge */}
              <span
                aria-hidden="true"
                className={`absolute -left-px top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)] transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? "text-fuchsia-300"
                    : "text-stone-500 group-hover:text-stone-300"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.06] p-4">
        <p className="flex items-start gap-2 font-mono text-[10px] leading-relaxed tracking-wide text-stone-600">
          <ShieldIcon className="mt-0.5 h-3 w-3 shrink-0 text-stone-600" />
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
    <header className="print-hidden sticky top-0 z-30 border-b border-white/[0.07] bg-carbon/80 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size="h-7 w-7" />
          <span className="font-display text-[15px] font-bold tracking-tight text-white">
            Debrief
          </span>
        </Link>
        <span className="font-mono text-[9px] uppercase tracking-widest text-stone-600">
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
      className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-carbon/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
                active ? "text-white" : "text-stone-500 active:text-stone-300"
              }`}
            >
              {/* Active rail: a lit signal notch on the tab's top edge */}
              <span
                aria-hidden="true"
                className={`absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)] transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.icon
                className={`h-5 w-5 ${active ? "text-fuchsia-300" : ""}`}
              />
              {item.label === "How it works" ? "Guide" : item.label === "Sample report" ? "Sample" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
