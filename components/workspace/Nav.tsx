"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui/brand";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import {
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  ListChecksIcon,
  ShieldIcon,
  SparklesIcon,
  ZapIcon,
} from "@/components/ui/icons";

/* Usability Simplification V1: the persistent primary nav is core
   product routes only — Pricing/Founding/About/vs. ChatGPT/Security
   moved to the workspace footer (see app/(workspace)/layout.tsx),
   which is reachable identically from desktop and mobile. Privacy
   moved there too, for the same reason: it's a trust/company page,
   not a tool a user picks between. */
const NAV = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/generator", label: "Generator", icon: ZapIcon },
  { href: "/competitor-debrief", label: "Competitor debrief", icon: SparklesIcon },
  { href: "/sample", label: "Sample report", icon: FileTextIcon },
  { href: "/how-it-works", label: "How it works", icon: HelpCircleIcon },
] as const;

/* Decision Queue / Multi-Account V1 — deliberately NOT a permanent
   6th entry in NAV above: it's useless (an explained-empty state)
   until at least one account has been debriefed, and a 6th item would
   also force MobileTabBar's fixed 5-column grid to change for every
   visitor, most of whom analyze a single account. Instead it appears
   here only once the session's portfolio is non-empty — still a real,
   persistent, always-reachable route once it matters, per CLAUDE.md's
   "user must always be able to return to queue" requirement — without
   cluttering the primary nav for the common single-account case. */
function useDecisionQueueNavItem() {
  const { portfolio } = useDebrief();
  return portfolio.length;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const queueCount = useDecisionQueueNavItem();

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
                  : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-300"
              }`}
            >
              <item.icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  active
                    ? "text-accent-soft"
                    : "text-zinc-500 group-hover:text-zinc-400"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
        {queueCount > 0 && (
          <Link
            href="/decision-queue"
            aria-current={isActive(pathname, "/decision-queue") ? "page" : undefined}
            className={`group mt-1 flex items-center gap-2.5 rounded-lg border-t border-white/[0.06] px-2.5 pt-3 pb-2 text-[13px] font-medium transition-colors ${
              isActive(pathname, "/decision-queue")
                ? "bg-white/[0.06] text-white"
                : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-300"
            }`}
          >
            <ListChecksIcon
              className={`h-4 w-4 shrink-0 transition-colors ${
                isActive(pathname, "/decision-queue")
                  ? "text-accent-soft"
                  : "text-zinc-500 group-hover:text-zinc-400"
              }`}
            />
            Decision Queue
            <span className="ml-auto shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
              {queueCount}
            </span>
          </Link>
        )}
      </nav>

      <div className="mt-auto border-t border-white/[0.06] p-4">
        <p className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-400">
          <ShieldIcon className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400" />
          Ads data in-memory only.
          <br />
          Never stored server-side.
        </p>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  const pathname = usePathname();
  const queueCount = useDecisionQueueNavItem();

  return (
    <header className="print-hidden sticky top-0 z-30 border-b border-white/[0.06] bg-carbon/90 backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-5">
        <Link href="/" className="flex shrink-0 items-center">
          <Wordmark />
        </Link>
        {queueCount > 0 ? (
          /* Decision Queue / Multi-Account V1 — mobile's tab bar stays a
             fixed 5-column grid (see MobileTabBar below), so this top-bar
             link is the persistent, always-reachable mobile route back to
             the queue once it has entries — it replaces the static
             privacy line only when there's something to navigate to;
             the privacy guarantee itself is unchanged and still shown
             everywhere else (sidebar, workspace footer). */
          <Link
            href="/decision-queue"
            aria-current={isActive(pathname, "/decision-queue") ? "page" : undefined}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            <ListChecksIcon className="h-3 w-3 text-accent-soft" />
            Queue
            <span className="rounded-full bg-white/10 px-1.5 text-[9px]">{queueCount}</span>
          </Link>
        ) : (
          <span className="text-[10px] font-medium text-zinc-400">
            Ads data never stored server-side
          </span>
        )}
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
                active ? "text-zinc-100" : "text-zinc-400 active:text-zinc-300"
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
              {item.label === "How it works"
                ? "Guide"
                : item.label === "Sample report"
                  ? "Sample"
                  : item.label === "Competitor debrief"
                    ? "Competitor"
                    : item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
