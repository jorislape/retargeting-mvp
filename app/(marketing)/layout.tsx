import { ReactNode } from "react";
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-5xl px-5 py-5 text-xs leading-relaxed text-zinc-600 sm:px-8">
          Not affiliated with Meta Platforms, Inc. Your CSV is processed in
          memory for this session only — nothing is stored.
        </div>
      </footer>
    </div>
  );
}
