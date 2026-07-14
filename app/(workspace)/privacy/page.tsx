import { ShieldIcon } from "@/components/ui/icons";
import {
  card,
  cardLift,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: "Privacy",
  description:
    "Your CSV is processed in memory for one request and never stored, cached, or logged. The only data stored server-side belongs to the optional competitor-monitoring beta, and only if you enable it.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS = [
  {
    title: "What happens to your CSV",
    body: "It's read into memory to generate your debrief and never written to a database, a file, a cache, or a log. There is no history page and no account — nothing to look back at, because nothing is kept. Refreshing the page really does erase everything.",
  },
  {
    title: "What we collect",
    body: "No login, no tracking, no analytics. The CSV you upload and the context you type are used solely to render the debrief in that same session and are never stored. If you enable the competitor-monitoring beta, Debrief sets ONE functional cookie: a random anonymous workspace ID (httpOnly, no personal data, not usable for tracking across sites). It exists so your monitored pages can be shown back to you. Clearing your cookies permanently disconnects this browser from that monitoring history — there is no account, so it cannot be recovered.",
  },
  {
    title: "Competitor watchlist (optional)",
    body: "If you use the competitor watchlist, its entries — competitor names, page URLs, your notes, and the public-page signal summaries you fetch — are saved in your own browser's localStorage, never on a server. Pages are read only when you click refresh; there is no background monitoring. Clearing the watchlist or your browser data removes it completely. Your CSV, reports, and Meta token are never saved this way. The watchlist is separate from the monitoring beta: importing a watchlist entry into monitoring copies the URL to the server; the watchlist itself stays in your browser.",
  },
  {
    title: "Competitor monitoring beta (optional)",
    body: "If you enable weekly monitoring for a competitor page, Debrief stores server-side: the page URL you entered, the deterministic signals extracted from that public page (headline, CTA, offer, claims — never a full page copy), and a short history of check outcomes. All of it is keyed to your anonymous workspace cookie, and none of it is ever connected to your ads data, which stays in-memory only. Scheduled checks run at most weekly; you can also retry a failed check manually. Pages that block us are recorded as blocked, never worked around. Removing a monitored page deletes it.",
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
          <span className={gradientText}>Nothing stored</span> — except what
          you ask us to. By design, not by policy.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          The strongest privacy guarantee is architecture: no accounts, no
          tracking, and your ads data is never stored server-side. Two
          optional features keep data anywhere at all: the competitor
          watchlist (in your own browser) and the competitor-monitoring beta
          (competitor URLs and extracted page signals on our server, tied to
          an anonymous cookie — never your ads data).
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
