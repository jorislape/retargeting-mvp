import type { ReactNode } from "react";
import Link from "next/link";
import { FlaskIcon, GaugeIcon, ShieldIcon } from "@/components/ui/icons";
import {
  card,
  cardLift,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: "About",
  description:
    "Debrief is a deterministic decision-support tool for media buyers running Meta Ads — not an AI-powered analyst. What it is, who it's for, and what it doesn't do.",
  alternates: { canonical: "/about" },
};

const SECTIONS: { icon: typeof GaugeIcon; title: string; body: ReactNode }[] = [
  {
    icon: GaugeIcon,
    title: "Who this is for",
    body: "Media buyers and small teams running Meta Ads who need a consistent read on a batch of ad performance — what worked, what to cut, what to test next — without rebuilding the same spreadsheet logic every time. It's built for someone who already knows how to read ad data and wants that read done the same way every time, not for someone who has never looked at a CPA before.",
  },
  {
    icon: FlaskIcon,
    title: "What \"decision-support\" means here",
    body: (
      <>
        Debrief is deterministic: the same valid CSV produces the same
        memo, every time. There&rsquo;s no model in the loop guessing at
        your numbers. Spend gates, medians, and confidence rules are fixed
        logic, not a prompt — see{" "}
        <Link
          href="/how-it-works"
          className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
        >
          how the rules work
        </Link>
        . It&rsquo;s a decision-support system, not an AI-powered one.
      </>
    ),
  },
  {
    icon: ShieldIcon,
    title: "What it's honest about not doing",
    body: "It doesn't predict future performance, guarantee scale, simulate a market, or fetch competitor data automatically. Creative-format detection from ad names is a guess until you confirm it. Competitor reads only work from what you paste in — nothing is scraped. When there isn't enough signal to say something, the memo says so instead of inventing a narrative.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>About</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>Same data, same answer.</span> Every
          time.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          Debrief turns Meta Ads performance data into a one-page decision:
          what worked, what to cut, and what to test next. The rules that
          produce that decision are fixed and published, not a black box.
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
                <section.icon className="h-3.5 w-3.5" />
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
        Questions or feedback? Contact{" "}
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
