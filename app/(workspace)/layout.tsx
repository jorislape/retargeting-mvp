import { ReactNode } from "react";
import { Atmosphere } from "@/components/workspace/Atmosphere";
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
        {/* No bg here — the body provides the carbon canvas; the
            Atmosphere layer adds the pointer-trailing desk lamp. */}
        <div className="flex min-h-dvh text-stone-100 antialiased">
          <Atmosphere />
          <Sidebar />
          <div className="min-w-0 flex-1 md:pl-56">
            <MobileTopBar />
            <main className="mx-auto max-w-4xl px-5 py-7 pb-24 sm:px-8 sm:py-10 md:pb-12">
              {children}
            </main>
            <footer className="print-hidden border-t border-white/[0.06] md:ml-0">
              <div className="mx-auto max-w-4xl px-5 py-5 pb-24 text-xs leading-relaxed text-stone-600 sm:px-8 md:pb-5">
                Not affiliated with Meta Platforms, Inc. Your CSV is processed
                in memory for this session only — nothing is stored.
              </div>
            </footer>
          </div>
          <MobileTabBar />
        </div>
      </MetaProvider>
    </DebriefProvider>
  );
}
