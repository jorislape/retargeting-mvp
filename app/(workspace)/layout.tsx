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
        <div className="workspace-shell flex min-h-dvh text-zinc-100 antialiased">
          <Sidebar />
          {/* print:pl-0 zeroes the sidebar offset on screen-narrow
              print engines, but Safari's print layout can still treat
              the md: breakpoint as active (it evaluates min-width
              against the screen viewport, not the physical page), and
              Tailwind gives md:pl-52/print:pl-0 equal specificity — so
              which one wins isn't guaranteed. .workspace-content-shell
              is the deterministic backstop in globals.css (!important,
              not cascade-order-dependent). */}
          <div className="workspace-content-shell min-w-0 flex-1 md:pl-52 print:pl-0">
            <MobileTopBar />
            <main className="report-print-page mx-auto max-w-4xl px-5 py-10 pb-24 sm:px-8 sm:py-14 md:pb-16">
              {children}
            </main>
            <footer className="print-hidden border-t border-white/[0.06] md:ml-0">
              <div className="mx-auto max-w-4xl px-5 py-5 pb-24 text-xs leading-relaxed text-zinc-400 sm:px-8 md:pb-5">
                Not affiliated with Meta Platforms, Inc. Your CSV is processed
                in memory for this session only — your ads data is never stored server-side.
              </div>
            </footer>
          </div>
          <MobileTabBar />
        </div>
      </MetaProvider>
    </DebriefProvider>
  );
}
