"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/brand";
import { ArrowIcon, MenuIcon, XIcon } from "@/components/ui/icons";
import { btnPrimarySm } from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* Marketing top nav — home route only. The app shell (sidebar/tabs)   */
/* stays on generator/sample/etc. via the (workspace) layout.          */
/* ------------------------------------------------------------------ */

const LINKS = [
  { href: "/sample", label: "Sample report" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function TopNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-carbon/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="rounded-sm transition-opacity hover:opacity-80"
        >
          <Wordmark />
        </Link>

        {/* Desktop links + CTA */}
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-sm text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/generator" className={btnPrimarySm}>
            Generate a debrief
            <ArrowIcon className="h-3.5 w-3.5" />
          </Link>
        </nav>

        {/* Mobile: menu toggle */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="marketing-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:border-white/20 hover:text-white md:hidden"
        >
          {open ? (
            <XIcon className="h-4 w-4" />
          ) : (
            <MenuIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <nav
          id="marketing-menu"
          aria-label="Primary"
          className="border-t border-white/[0.06] bg-carbon/95 px-5 py-4 backdrop-blur md:hidden"
        >
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2.5 py-2.5 text-[14px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/generator"
              onClick={() => setOpen(false)}
              className={`mt-2 ${btnPrimarySm}`}
            >
              Generate a debrief
              <ArrowIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
