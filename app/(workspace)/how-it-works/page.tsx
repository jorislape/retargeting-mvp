import Link from "next/link";
import {
  ArrowIcon,
  FileTextIcon,
  FlaskIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import {
  btnPrimary,
  btnSecondaryMd,
  card,
  cardLift,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: "How it works",
  description:
    "Three steps, deterministic scoring — no black box between your CSV and the call.",
  alternates: { canonical: "/how-it-works" },
};

const STEPS = [
  {
    icon: FileTextIcon,
    title: "Add Meta Ads data",
    text: "Connect Meta, upload a CSV, or explore sample data. Column names vary by export and Debrief resolves the common variants automatically.",
  },
  {
    icon: SparklesIcon,
    title: "Add optional context",
    text: "Set your KPI, add goals, constraints, and market signals only when useful, and confirm creative formats so the read doesn't rely on ad names alone.",
  },
  {
    icon: FlaskIcon,
    title: "Get the decision",
    text: "Get a buyer memo, client report, next tests, and creative briefs — verdict first. Copy it or save it as a PDF.",
  },
];

const RULES = [
  {
    term: "Spend gate",
    detail:
      "Ads with too little spend can't be judged fairly. With a target CPA the gate is 3× that CPA; without one it's max($10, half the average spend per ad). Ads below it are set aside — never called winners or losers.",
  },
  {
    term: "Median benchmark",
    detail:
      "The benchmark is the median KPI across judged ads only, so one outlier can't move the bar the way an average would.",
  },
  {
    term: "Polarity",
    detail:
      "Higher is better for ROAS, CTR, leads, and purchases. Lower is better for CPA and CPC. Deltas are always expressed in the direction that means \"better.\"",
  },
  {
    term: "Winners and losers",
    detail:
      "Up to five judged ads on each side of the median, ranked by distance from it. If only two ads qualify, you see two — the list is never padded.",
  },
  {
    term: "Honesty rule",
    detail:
      "If there are no creative notes and no format signal in your ad names, the memo says \"metrics only — angle unknown\" instead of inventing a creative story.",
  },
];

export default function HowItWorksPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>How it works</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Three steps. <span className={gradientText}>No black box.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          Every number in a debrief is computed from your CSV with rules you
          can read below — not a model&apos;s opinion.
        </p>
      </header>

      {/* Steps */}
      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className={`animate-rise ${card} ${cardLift} p-5`}
            style={{ animationDelay: `${90 + i * 90}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className={`h-9 w-9 ${iconChip}`}>
                <step.icon className="h-4 w-4" />
              </div>
              <span className="font-mono text-[11px] font-semibold text-zinc-400">
                0{i + 1}
              </span>
            </div>
            <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-white">
              {step.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
              {step.text}
            </p>
          </li>
        ))}
      </ol>

      {/* Deterministic scoring */}
      <section className="animate-rise mt-12" style={{ animationDelay: "270ms" }}>
        <p className={eyebrow}>Deterministic scoring</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
          The rules, in plain sight
        </h2>
        <div className={`mt-4 ${card} divide-y divide-white/[0.06]`}>
          {RULES.map((rule) => (
            <div
              key={rule.term}
              className="grid gap-1.5 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-soft">
                {rule.term}
              </dt>
              <dd className="text-[13px] leading-relaxed text-zinc-400">
                {rule.detail}
              </dd>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          The same engine renders the{" "}
          <Link
            href="/sample"
            className="rounded-sm text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/60"
          >
            sample report
          </Link>{" "}
          from example data — what you see there is exactly what your CSV
          produces.
        </p>
      </section>

      {/* CTA */}
      <div className="animate-rise mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "360ms" }}>
        <Link href="/generator" className={btnPrimary}>
          Debrief your ads
          <ArrowIcon className="h-4 w-4" />
        </Link>
        <Link href="/sample" className={btnSecondaryMd}>
          View the sample first
        </Link>
      </div>
    </div>
  );
}
