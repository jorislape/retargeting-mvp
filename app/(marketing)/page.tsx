import Link from "next/link";
import { HeroProof } from "@/components/marketing/HeroProof";
import {
  ArrowIcon,
  CheckIcon,
  FileTextIcon,
  FlaskIcon,
  GaugeIcon,
  LayersIcon,
  ShieldIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  ZapIcon,
} from "@/components/ui/icons";
import {
  btnPrimary,
  btnSecondaryMd,
  card,
  cardLift,
  gradientText,
} from "@/components/ui/theme";

export const metadata = {
  title: "Debrief — Turn Meta Ads data into creative decisions",
  description:
    "Upload a Meta Ads CSV or connect Meta read-only. Debrief turns ad performance into a buyer memo and a client-ready report. No login, nothing stored.",
};

/* ------------------------------------------------------------------ */
/* Home: the first impression. Positions the product, shows the        */
/* pipeline (data in → deterministic engine → two reports out) as a    */
/* designed visual, then hands off to the Generator. Server component  */
/* — all interaction is CSS (hover lift, entrance stagger).            */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: TrendingUpIcon,
    iconClass: "text-emerald-400",
    title: "Top performers",
    text: "Which ads beat the account median, by how much, and on what spend.",
  },
  {
    icon: TrendingDownIcon,
    iconClass: "text-red-400",
    title: "Underperformers",
    text: "The kill list — ads running below benchmark, with the combined spend at stake.",
  },
  {
    icon: GaugeIcon,
    iconClass: "text-accent-soft",
    title: "Fair judgement",
    text: "Ads without enough spend are set aside, never mislabeled winners or losers.",
  },
  {
    icon: LayersIcon,
    iconClass: "text-accent-soft",
    title: "Winner / loser patterns",
    text: "Format signals across your winners and losers — UGC vs static vs video.",
  },
  {
    icon: FlaskIcon,
    iconClass: "text-accent-soft",
    title: "Next creative tests",
    text: "Three concrete tests tied to your data: why, setup, and what winning looks like.",
  },
  {
    icon: FileTextIcon,
    iconClass: "text-accent-soft",
    title: "Client-ready report",
    text: "One toggle turns the buyer memo into a plain-language report you can send.",
  },
];

const TRUST = [
  "No login required for the CSV flow",
  "Nothing stored — parsed in memory, gone on refresh",
  "Meta connection is optional and read-only (ads_read)",
  "Reports render in your session only",
];

/* A miniature document — designed, not screenshotted. Real numbers
   from the sample dataset so the promise matches the product. */
function MiniBuyerMemo() {
  return (
    <div className="rounded-lg border border-white/[0.09] bg-panel p-3.5 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.7)] transition motion-safe:duration-200 motion-safe:hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          Buyer memo
        </p>
        <span className="h-1 w-6 rounded-full bg-accent" aria-hidden="true" />
      </div>
      <p className="mt-2 text-[11px] font-medium leading-snug text-zinc-200">
        “UGC_MorningRoutine_V1” leads at 4.62× ROAS — move budget toward it.
      </p>
      <div className="mt-2.5 space-y-1.5 font-mono text-[9px] tabular-nums">
        {[
          ["01", "UGC_MorningRoutine_V1", "4.62x", "+100%", true],
          ["02", "Testimonial_CustomerReview", "4.18x", "+81%", true],
          ["11", "Static_StockPhoto_Generic", "0.62x", "−73%", false],
        ].map(([n, name, val, delta, win]) => (
          <div key={n as string} className="flex items-center gap-2">
            <span className={win ? "text-emerald-400" : "text-red-400"}>
              {n}
            </span>
            <span className="min-w-0 flex-1 truncate text-zinc-400">
              {name}
            </span>
            <span className="text-zinc-200">{val}</span>
            <span className={win ? "text-emerald-400" : "text-red-400"}>
              {delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniClientReport() {
  return (
    <div className="rounded-lg border border-white/[0.09] bg-panel p-3.5 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.7)] transition motion-safe:duration-200 motion-safe:hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          Client report
        </p>
        <span className="h-1 w-6 rounded-full bg-accent/50" aria-hidden="true" />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-zinc-300">
        Your strongest ad returned 4.62× — clearly ahead of the account’s
        typical result.
      </p>
      <div className="mt-2.5 space-y-1.5">
        {[
          ["What worked", "border-emerald-400/70"],
          ["What we’ll test next", "border-accent/60"],
        ].map(([label, rail]) => (
          <div
            key={label as string}
            className={`border-l-2 ${rail} py-0.5 pl-2 text-[9px] font-medium text-zinc-400`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div
      aria-hidden="true"
      className="flex justify-center text-zinc-600 md:block"
    >
      <ArrowIcon className="h-4 w-4 rotate-90 md:rotate-0" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      {/* ---- Hero ---- */}
      <section className="animate-rise pt-4 text-center sm:pt-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-zinc-400">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-accent"
          />
          Creative debrief for Meta Ads
        </p>
        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
          Turn Meta Ads data into your{" "}
          <span className={gradientText}>next creative decisions.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-zinc-400">
          Upload a Meta Ads CSV or connect Meta read-only. Debrief turns ad
          performance into a buyer memo and a client-ready report.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/generator" className={btnPrimary}>
            Generate a debrief
            <ArrowIcon className="h-4 w-4" />
          </Link>
          <Link href="/sample" className={btnSecondaryMd}>
            View sample report
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          No login · Nothing stored · Optional read-only Meta connection
        </p>

        {/* Live proof: the engine sorting real-shaped rows, on loop. */}
        <div className="mx-auto mt-12 max-w-2xl text-left">
          <HeroProof />
        </div>
      </section>

      {/* ---- The pipeline, designed ---- */}
      <section
        className="animate-rise mt-14"
        style={{ animationDelay: "90ms" }}
        aria-label="How data becomes a debrief"
      >
        <div className={`${card} p-5 sm:p-7`}>
          <div className="grid items-center gap-5 md:grid-cols-[1fr_auto_1.1fr_auto_1.15fr] md:gap-4">
            {/* Inputs */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <FileTextIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] font-medium text-zinc-200">
                    meta-ads-export.csv
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    Ad-level · any column set
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                <ZapIcon className="h-4 w-4 shrink-0 text-accent-soft" />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-zinc-200">
                    Meta Ads · read-only
                  </p>
                  <p className="text-[10px] text-zinc-600">OAuth · ads_read</p>
                </div>
              </div>
            </div>

            <FlowArrow />

            {/* Engine */}
            <div className="rounded-lg border border-accent/20 bg-accent/[0.04] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-soft">
                Deterministic engine
              </p>
              <ul className="mt-2 space-y-1.5">
                {[
                  "Read every ad",
                  "Apply the spend gate",
                  "Rank against the median",
                  "Write both reports",
                ].map((step, i) => (
                  <li
                    key={step}
                    className="flex items-center gap-2 text-[11px] text-zinc-300"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/15 font-mono text-[8px] text-zinc-500">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[10px] text-zinc-600">
                Rules, not a model — same input, same answer.
              </p>
            </div>

            <FlowArrow />

            {/* Outputs */}
            <div className="space-y-2.5">
              <MiniBuyerMemo />
              <MiniClientReport />
            </div>
          </div>
        </div>
      </section>

      {/* ---- The problem ---- */}
      <section
        className="animate-rise mx-auto mt-16 max-w-2xl text-center"
        style={{ animationDelay: "150ms" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          The problem
        </p>
        <p className="mt-4 text-xl font-medium leading-relaxed text-zinc-200 sm:text-2xl">
          Dashboards show numbers.{" "}
          <span className="text-zinc-500">
            Media buyers still have to decide what to do next.
          </span>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-500">
          Debrief reads the same export you already have and answers the
          questions that actually end a reporting call: what worked, what
          failed, what to test next.
        </p>
      </section>

      {/* ---- What you get ---- */}
      <section className="animate-rise mt-16" style={{ animationDelay: "210ms" }}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Every debrief answers six questions
          </h2>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className={`${card} ${cardLift} p-5`}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                <f.icon className={`h-4 w-4 ${f.iconClass}`} />
              </div>
              <h3 className="mt-3.5 text-[14px] font-semibold tracking-tight text-zinc-100">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Trust ---- */}
      <section className="animate-rise mt-16" style={{ animationDelay: "270ms" }}>
        <div className={`${card} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="max-w-[16rem]">
              <p className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-zinc-100">
                <ShieldIcon className="h-4 w-4 text-accent-soft" />
                Private by architecture
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
                There is no database to leak from — the strongest privacy
                guarantee is having nothing to protect.
              </p>
            </div>
            <ul className="grid flex-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {TRUST.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-300"
                >
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---- Final CTA ---- */}
      <section
        className="animate-rise mt-16 text-center"
        style={{ animationDelay: "330ms" }}
      >
        <div className={`${card} px-6 py-10 sm:py-12`}>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            See your account the way a{" "}
            <span className={gradientText}>senior buyer reads it.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Two minutes from export to memo. No CSV handy? The generator
            includes a full sample dataset.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/generator" className={btnPrimary}>
              Generate a debrief
              <ArrowIcon className="h-4 w-4" />
            </Link>
            <Link href="/generator" className={btnSecondaryMd}>
              <FlaskIcon className="h-4 w-4 text-zinc-400" />
              Try it with sample data
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
