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
  title: "Terms",
  description:
    "Plain-language terms for Debrief: deterministic decision support for Meta Ads, in beta. You make the budget decisions; Debrief guarantees no results.",
  alternates: { canonical: "/terms" },
};

/* Plain-language terms, same layout as /privacy. The Founding Pilot
   section restates /founding and /pricing word for word in substance
   (€149, initial 30 days, arranged manually, invoiced, no auto-renewal,
   continuing = a new separate agreement, software stays free) — it adds
   no new commercial terms. Not reviewed by a lawyer yet. */
const SECTIONS = [
  {
    title: "What Debrief is",
    body: "Debrief is deterministic decision support for Meta Ads, currently in beta. It reads the ad-level data you provide — a CSV export or a read-only Meta connection — and applies fixed, published rules to produce a memo: what worked, what didn't, what to test next. It is not financial, legal, or business advice, and it does not run, change, or spend on your ad account.",
  },
  {
    title: "Your decisions stay yours",
    body: "You are responsible for your own budget and campaign decisions. Before acting on anything in a report — especially a material budget change — confirm the underlying figures in Meta Ads Manager. Debrief can only read the data it's given; exports can be incomplete, attribution settings differ, and results depend on conditions an export doesn't capture.",
  },
  {
    title: "No guarantee of results",
    body: "Debrief describes what happened in the data you provide; it doesn't promise what will happen next. A recommendation that follows from past performance is not a guarantee of future performance, revenue, or return on ad spend.",
  },
  {
    title: "The free tool, as-is",
    body: "The free CSV tool is provided as-is and as-available, without warranties of any kind. It may change, be interrupted, or be withdrawn during the beta.",
  },
  {
    title: "The Founding Pilot",
    body: "The Founding Pilot is €149 for an initial 30 days, arranged manually and paid by invoice — no auto-renewal; continuing past 30 days means a new, separate agreement. The Debrief software itself stays free either way.",
  },
  {
    title: "Liability",
    body: "To the fullest extent the law allows, Debrief is not liable for losses arising from decisions made using its reports, and any liability is limited to the amount you paid for the service in question (for the free tool, nothing).",
  },
];

export default function TermsPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Terms</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>Plain terms.</span> Short on
          purpose.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          What you can expect from Debrief, and what stays your call. How
          your data is handled is covered on{" "}
          <Link
            href="/privacy"
            className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
          >
            the privacy page
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

      <p className="animate-rise mt-8 text-sm leading-relaxed text-zinc-400" style={{ animationDelay: "630ms" }}>
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
