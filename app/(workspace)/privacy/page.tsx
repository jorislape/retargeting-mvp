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
    title: "Meta affiliation",
    body: "Debrief reads CSV exports you download yourself, or — only if you choose to connect — pulls read-only insights (ads_read) from the Meta API. The access token lives in your browser's memory for the session and is never stored. Debrief isn't affiliated with or endorsed by Meta Platforms, Inc.",
  },
];

export default function PrivacyPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Privacy</p>
        <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight text-white sm:text-3xl">
          <span className={gradientText}>Nothing stored.</span> By design,
          not by policy.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone-400">
          The strongest privacy guarantee is architecture: this tool has no
          database, no accounts, and no storage to leak from.
        </p>
      </header>

      <div className="mt-8 space-y-3">
        {SECTIONS.map((section, i) => (
          <section
            key={section.title}
            className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
            style={{ animationDelay: `${90 + i * 90}ms` }}
          >
            <h2 className="flex items-center gap-2.5 font-display text-[15px] font-semibold text-white">
              {/* Neutral chip — green is reserved for win/loss */}
              <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
                <ShieldIcon className="h-3.5 w-3.5" />
              </span>
              {section.title}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-stone-400">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <p className="animate-rise mt-8 text-sm leading-relaxed text-stone-500" style={{ animationDelay: "360ms" }}>
        Questions? Contact{" "}
        <a
          href="mailto:joris.adomas@gmail.com"
          className="rounded-sm font-medium text-stone-200 underline decoration-stone-600 underline-offset-4 transition hover:text-brass-soft hover:decoration-brass/60 active:text-brass-soft"
        >
          joris.adomas@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
