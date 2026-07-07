import { ReactNode } from "react";
import { DebriefProvider } from "@/components/workspace/DebriefProvider";
import { MetaProvider } from "@/components/workspace/MetaProvider";
import { MobileTabBar, MobileTopBar, Sidebar } from "@/components/workspace/Nav";

/*
 * The workspace shell: persistent sidebar (desktop) / top bar + bottom
 * tabs (mobile) around every section. Navigation between sections is
 * client-side (Next Link), and DebriefProvider lives here so a
 * generated report survives moving between sections — but only in
 * React state: a refresh clears the session completely.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <DebriefProvider>
      <MetaProvider>
        {/* No bg here — the body provides the carbon canvas. */}
        <div className="flex min-h-dvh text-zinc-100 antialiased">
          <Sidebar />
          {/* print:pl-0 — the sidebar is print-hidden, so its layout
              offset must go too or the printed report sits off-center. */}
          <div className="min-w-0 flex-1 md:pl-52 print:pl-0">
            <MobileTopBar />
            <main className="mx-auto max-w-4xl px-5 py-10 pb-24 sm:px-8 sm:py-14 md:pb-16">
              {children}
            </main>
            <footer className="print-hidden border-t border-white/[0.06] md:ml-0">
              <div className="mx-auto max-w-4xl px-5 py-5 pb-24 text-xs leading-relaxed text-zinc-400 sm:px-8 md:pb-5">
                Not affiliated with Meta Platforms, Inc. Your CSV is processed
                in memory for this session only — nothing is stored server-side.
              </div>
            </footer>
          </div>
          <MobileTabBar />
        </div>
      </MetaProvider>
    </DebriefProvider>
  );
}
