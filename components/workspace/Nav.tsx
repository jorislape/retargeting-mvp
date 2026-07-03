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
    <aside className="print-hidden fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-white/5 bg-zinc-950 md:flex">
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/5 px-4"
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
              className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-500/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? "text-blue-400"
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
    <header className="print-hidden sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur md:hidden">
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
      className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                active ? "text-white" : "text-zinc-500 active:text-zinc-300"
              }`}
            >
              <item.icon className={`h-5 w-5 ${active ? "text-blue-400" : ""}`} />
              {item.label === "How it works" ? "Guide" : item.label === "Sample report" ? "Sample" : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
