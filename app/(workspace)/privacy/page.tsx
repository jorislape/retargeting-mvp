import { ShieldIcon } from "@/components/ui/icons";
import {
  card,
  cardLift,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: "Privacy — Debrief",
  description:
    "Your CSV is processed in memory for one request and never stored, cached, or logged.",
};

const SECTIONS = [
  {
    title: "What happens to your CSV",
    body: "It's read into memory to generate your debrief and never written to a database, a file, a cache, or a log. There is no history page and no account — nothing to look back at, because nothing is kept. Refreshing the page really does erase everything.",
  },
  {
    title: "What we collect",
    body: "Nothing. No login, no tracking, no analytics. The only data involved is the CSV you upload and the context you type, both used solely to render the debrief shown back to you in that same session.",
  },
  {
    title: "Competitor watchlist (optional)",
    body: "If you use the competitor watchlist, its entries — competitor names, page URLs, your notes, and the public-page signal summaries you fetch — are saved in your own browser's localStorage, never on a server. Pages are read only when you click refresh; there is no background monitoring. Clearing the watchlist or your browser data removes it completely. Your CSV, reports, and Meta token are never saved this way.",
  },
  {
    title: "Meta affiliation",
    body: "Debrief reads CSV exports you download yourself, or — only if you choose to connect — pulls read-only insights (ads_read) from the Meta API. The access token lives in your browser's memory for the session and is never stored. Debrief isn't affiliated with or endorsed by Meta Platforms, Inc.",
  },
];

export default function PrivacyPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Privacy</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>Nothing stored.</span> By design,
          not by policy.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          The strongest privacy guarantee is architecture: this tool has no
          database, no accounts, and no server-side storage to leak from.
          The one thing kept anywhere is the optional competitor watchlist,
          and it lives in your own browser.
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
              {/* Neutral chip — green is reserved for win/loss */}
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

      <p className="animate-rise mt-8 text-sm leading-relaxed text-zinc-400" style={{ animationDelay: "360ms" }}>
        Questions? Contact{" "}
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
