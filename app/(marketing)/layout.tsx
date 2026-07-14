import { ReactNode } from "react";
import Link from "next/link";
import { TopNav } from "@/components/marketing/TopNav";

/*
 * The marketing shell: a conventional top navbar instead of the app
 * sidebar. Only the home route lives here — the working surfaces
 * (generator, sample, guide, privacy) keep the (workspace) shell and
 * its providers. Home needs neither Debrief nor Meta state.
 */
export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col text-zinc-100 antialiased">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:py-8">
        {children}
      </main>
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-5xl space-y-2 px-5 py-5 text-xs leading-relaxed text-zinc-400 sm:px-8">
          <p>
            Not affiliated with Meta Platforms, Inc. Your CSV is processed in
            memory for this session only — your ads data is never stored server-side.
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/pricing" className="underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-200 hover:decoration-zinc-400">
              Pricing
            </Link>
            <Link href="/about" className="underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-200 hover:decoration-zinc-400">
              About
            </Link>
            <Link href="/privacy" className="underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-200 hover:decoration-zinc-400">
              Privacy
            </Link>
            <Link href="/security" className="underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-200 hover:decoration-zinc-400">
              Security
            </Link>
            <a href="mailto:joris.adomas@gmail.com" className="underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-200 hover:decoration-zinc-400">
              joris.adomas@gmail.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
