import { ShieldIcon } from "@/components/ui/icons";
import { card, eyebrow } from "@/components/ui/theme";

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
    body: "Debrief reads CSV exports you download yourself from Meta Ads Manager. It doesn't connect to your ad account, requests no permissions, and isn't affiliated with or endorsed by Meta Platforms, Inc.",
  },
];

export default function PrivacyPage() {
  return (
    <div>
      <header>
        <p className={eyebrow}>Privacy</p>
        <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white sm:text-[28px]">
          Nothing stored. By design, not by policy.
        </h1>
        <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-zinc-400">
          The strongest privacy guarantee is architecture: this tool has no
          database, no accounts, and no storage to leak from.
        </p>
      </header>

      <div className="mt-7 space-y-3">
        {SECTIONS.map((section) => (
          <section key={section.title} className={`${card} p-5 sm:p-6`}>
            <h2 className="flex items-center gap-2.5 font-display text-[15px] font-semibold text-white">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10">
                <ShieldIcon className="h-3.5 w-3.5 text-emerald-300" />
              </span>
              {section.title}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-7 text-sm leading-relaxed text-zinc-500">
        Questions? Contact{" "}
        <a
          href="mailto:joris.adomas@gmail.com"
          className="font-medium text-zinc-300 underline decoration-white/20 underline-offset-4 transition hover:text-white hover:decoration-white/40"
        >
          joris.adomas@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
