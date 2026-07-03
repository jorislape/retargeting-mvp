import Link from "next/link";
import { DebriefApp } from "@/components/debrief/DebriefApp";
import { LogoMark } from "@/components/ui/brand";

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100 antialiased">
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-sm font-bold tracking-tight text-white">
              Debrief
            </span>
          </div>
          <Link
            href="/privacy"
            className="text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
          >
            Privacy
          </Link>
        </div>
      </header>

      <DebriefApp />

      <footer className="border-t border-white/5">
        <div className="mx-auto max-w-3xl px-5 py-6 text-center text-xs text-zinc-600 sm:px-6">
          Not affiliated with Meta Platforms, Inc. Your CSV is processed in
          memory for this session only — nothing is stored.
        </div>
      </footer>
    </main>
  );
}
