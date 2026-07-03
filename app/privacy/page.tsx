import Link from "next/link";
import { LogoMark } from "@/components/ui/brand";
import { ArrowIcon } from "@/components/ui/icons";

export const metadata = {
  title: "Privacy Policy — Debrief",
};

export default function Privacy() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size="h-7 w-7" />
            <span className="text-sm font-bold tracking-tight text-white">
              Debrief
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white"
          >
            Back to home
            <ArrowIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Privacy Policy
        </h1>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-base font-semibold text-white">
              What happens to your CSV
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
              Your CSV is read into memory to generate your debrief and is
              never written to a database, a file, a cache, or a log. There
              is no history page and no account — nothing to look back at
              because nothing is kept.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              What we collect
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
              Nothing. There&apos;s no login, no tracking, and no analytics
              on this tool. The only data involved is the CSV you upload and
              the context you type in, both used solely to generate the
              debrief shown back to you in that same session.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">
              Meta affiliation
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
              This tool reads CSV exports you download yourself from Meta
              Ads Manager. It doesn&apos;t connect to your ad account and
              isn&apos;t affiliated with or endorsed by Meta Platforms, Inc.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
              Questions? Contact{" "}
              <a
                href="mailto:joris.adomas@gmail.com"
                className="font-medium text-zinc-200 underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white/40"
              >
                joris.adomas@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-white/5">
        <div className="mx-auto max-w-3xl px-5 py-7 text-xs text-zinc-500 sm:px-6">
          Not affiliated with Meta Platforms, Inc.
        </div>
      </footer>
    </main>
  );
}
