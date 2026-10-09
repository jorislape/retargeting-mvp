import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/brand";
import { btnPrimarySm, btnSecondary, eyebrow, gradientText } from "@/components/ui/theme";

/* The root 404. It renders inside app/layout.tsx only (no workspace
   shell or providers), so it carries its own minimal frame in the same
   tokens the workspace pages use: wordmark, eyebrow, gradient phrase,
   white primary + translucent secondary action. Never indexed. */
export const metadata: Metadata = {
  title: "Not found", // root template → "Not found · Debrief"
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 text-zinc-100 antialiased sm:px-8">
      <Link
        href="/"
        className="w-fit rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <Wordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-16">
        <p className={eyebrow}>404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>This page doesn&apos;t exist.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          The link may be old or mistyped. Debrief has two places to start:
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/generator" className={btnPrimarySm}>
            Generator
          </Link>
          <Link href="/sample" className={btnSecondary}>
            Sample report
          </Link>
        </div>
      </main>
    </div>
  );
}
