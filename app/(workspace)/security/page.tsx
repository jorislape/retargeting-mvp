import Link from "next/link";
import { ShieldIcon } from "@/components/ui/icons";
import {
  card,
  cardLift,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: "Security",
  description:
    "Raw ads data is never stored server-side, on any tier. What's session-only today, what already persists (and why that's not your ads data), and what's planned.",
  alternates: { canonical: "/security" },
};

const SECTIONS = [
  {
    title: "What's session-only today",
    body: "The CSV generator, the competitor debrief, and internal learnings all run in memory for one request and are discarded when it's done. Nothing is written to a database, a file, a cache, or a log. There's no account and no history page — refreshing the page erases everything, because there's nothing kept to look back at.",
  },
  {
    title: "What already persists — opt-in, and never your ads data",
    body: "Two features store something server-side today, and both are opt-in: the competitor-monitoring beta stores the competitor page URLs you add and the deterministic signals extracted from those public pages (headline, CTA, offer, claims — never a full page copy), keyed to an anonymous workspace cookie, not an account. The competitor watchlist stores its entries (names, URLs, notes, fetched page signals) in your own browser's localStorage — never on our servers. Neither ever touches your CSV, your memos, or your Meta token.",
  },
  {
    title: "What's planned — not built yet",
    body: "A future opt-in workspace may let you save structured learnings you write yourself: a learning's type, hook, angle, format, outcome, your note, its source, an account reference, and when you created it. That's a structured conclusion you author, not your raw ads data — the CSVs, row-level performance, spend figures, and ad names stay exactly as they are today: never stored. This workspace doesn't exist yet. No accounts, login, or persistence beyond what's described above exist in the product today. When this ships, it will be documented here first, with its own explicit scope.",
  },
  {
    title: "Meta affiliation and access",
    body: "The optional Meta connection uses read-only ads_read access. The access token lives in your browser's memory for the session and is never sent anywhere but Meta's API and never stored on our servers. Debrief isn't affiliated with or endorsed by Meta Platforms, Inc.",
  },
];

export default function SecurityPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>Raw ads data</span> never touches our
          servers. On any tier.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          We do not store uploaded CSVs, raw pasted ads, ad names, spend
          figures, or row-level performance data — on any tier. That&rsquo;s
          the permanent promise. Everything below explains what that does and
          doesn&rsquo;t cover, including two small, opt-in exceptions that
          store other data, and one thing that&rsquo;s planned but not built.
          Full detail on session behavior and cookies:{" "}
          <Link
            href="/privacy"
            className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
          >
            /privacy
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 space-y-3">
        {SECTIONS.map((section, i) => (
          <section
            key={section.title}
            className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
            style={{ animationDelay: `${90 + i * 90}ms` }}
          >
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
              <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
                <ShieldIcon className="h-3.5 w-3.5" />
              </span>
              {section.title}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <p className="animate-rise mt-8 text-sm leading-relaxed text-zinc-400" style={{ animationDelay: "450ms" }}>
        Found a security issue, or have a question? Contact{" "}
        <a
          href="mailto:joris.adomas@gmail.com"
          className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
        >
          joris.adomas@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
