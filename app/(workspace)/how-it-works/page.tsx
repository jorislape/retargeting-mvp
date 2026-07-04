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
  title: "How it works — Debrief",
  description:
    "Three steps, deterministic scoring — no black box between your CSV and the call.",
};

const STEPS = [
  {
    icon: FileTextIcon,
    title: "Upload your CSV",
    text: "Export ad-level performance from Meta Ads Manager and drop it in. Column names vary by export — Debrief resolves the common variants automatically.",
  },
  {
    icon: SparklesIcon,
    title: "Set KPI and context",
    text: "Pick the metric that matters this period and add one line each of product, offer, and goal. A target CPA sharpens the spend gate; creative notes sharpen the angle analysis.",
  },
  {
    icon: FlaskIcon,
    title: "Read the debrief",
    text: "A one-page memo: verdict first, then winners, kill list, patterns, and the next three tests as a run-list. Copy it or save it as a PDF.",
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
        <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight text-white sm:text-3xl">
          Three steps. <span className={gradientText}>No black box.</span>
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone-400">
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
              <span className="font-mono text-[11px] font-semibold tracking-widest text-stone-600">
                0{i + 1}
              </span>
            </div>
            <h2 className="mt-4 font-display text-[15px] font-semibold text-white">
              {step.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-stone-400">
              {step.text}
            </p>
          </li>
        ))}
      </ol>

      {/* Deterministic scoring */}
      <section className="animate-rise mt-12" style={{ animationDelay: "270ms" }}>
        <p className={eyebrow}>Deterministic scoring</p>
        <h2 className="mt-2 font-display text-lg font-bold tracking-tight text-white">
          The rules, in plain sight
        </h2>
        <div className={`mt-4 ${card} divide-y divide-white/[0.06]`}>
          {RULES.map((rule) => (
            <div
              key={rule.term}
              className="grid gap-1.5 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6"
            >
              <dt className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-300">
                {rule.term}
              </dt>
              <dd className="text-[13px] leading-relaxed text-stone-400">
                {rule.detail}
              </dd>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          The same engine renders the{" "}
          <Link
            href="/sample"
            className="rounded-sm text-stone-300 underline decoration-stone-600 underline-offset-2 transition hover:text-amber-300 hover:decoration-amber-400/60"
          >
            sample report
          </Link>{" "}
          from example data — what you see there is exactly what your CSV
          produces.
        </p>
      </section>

      {/* CTA */}
      <div className="animate-rise mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "360ms" }}>
        <Link href="/" className={btnPrimary}>
          Generate a debrief
          <ArrowIcon className="h-4 w-4" />
        </Link>
        <Link href="/sample" className={btnSecondaryMd}>
          View the sample first
        </Link>
      </div>
    </div>
  );
}
