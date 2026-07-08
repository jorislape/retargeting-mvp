import Link from "next/link";
import { BlurFade } from "@/components/marketing/BlurFade";
import { HeroProof } from "@/components/marketing/HeroProof";
import { KpiDemo } from "@/components/marketing/KpiDemo";
import {
  ArrowIcon,
  CheckIcon,
  FileTextIcon,
  FlaskIcon,
  GaugeIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import {
  btnPrimary,
  btnSecondaryMd,
  card,
  cardHover,
  cardLift,
  gradientText,
} from "@/components/ui/theme";

export const metadata = {
  title: "Debrief — Your Meta Ads data, turned into a decision",
  description:
    "Upload a CSV or pull data from Meta, add market / competitor signals if useful, and get a buyer memo, client-ready report, next creative tests, and creative briefs. No login, nothing stored on our servers.",
};

/* ------------------------------------------------------------------ */
/* Home: the first impression. Positions the product for solo buyers,  */
/* freelancers, and small agencies — export in, decision out — then    */
/* hands off to the Generator. Server component; interaction is CSS    */
/* plus the isolated marketing demos.                                  */
/* ------------------------------------------------------------------ */

const BENEFITS = [
  {
    icon: GaugeIcon,
    title: "Decide faster",
    text: "See what worked, what underperformed, and what deserves the next test — without building another spreadsheet.",
  },
  {
    icon: FileTextIcon,
    title: "Explain it to clients",
    text: "Turn the same analysis into a plain-English client report with the key decisions and next steps.",
  },
  {
    icon: FlaskIcon,
    title: "Brief the next creative",
    text: "Select recommended tests and turn them into grounded creative briefs based on your own performance signals.",
  },
  {
    icon: ShieldIcon,
    title: "Avoid bad calls",
    text: "Spend gates and confidence notes help you avoid killing low-spend ads too early or scaling weak winners.",
  },
];

const STEPS: { title: string; text: string }[] = [
  {
    title: "Add Meta Ads data",
    text: "Connect Meta, upload a CSV, or explore sample data.",
  },
  {
    title: "Add optional context",
    text: "Add goals, constraints, and market signals only when useful.",
  },
  {
    title: "Get the decision",
    text: "Get a buyer memo, client report, next tests, and creative briefs.",
  },
];

const TRUST = [
  "No login required",
  "CSV processed in your session only — no database, nothing stored server-side",
  "No monitoring or scraping — a competitor page is read once, only when you ask",
  "Ads are never launched or changed",
  "Meta connection optional and read-only (ads_read)",
];

/* A miniature document — designed, not screenshotted. Real numbers
   from the sample dataset so the promise matches the product. */
function MiniBuyerMemo() {
  return (
    <div className="rounded-lg border border-white/[0.09] bg-panel p-3.5 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.7)] transition motion-safe:duration-200 motion-safe:hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
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

export default function HomePage() {
  return (
    <div>
      {/* ---- Hero ---- */}
      <section className="animate-rise pt-4 text-center sm:pt-10 lg:pt-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-zinc-400">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-accent"
          />
          For media buyers and lean marketing teams
        </p>
        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
          Your Meta Ads data,{" "}
          <span className={gradientText}>turned into a decision</span> — in
          two minutes.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
          Upload a CSV or pull data from Meta. Add market / competitor
          signals if useful. Get a buyer memo, client-ready report, next
          creative tests, and creative briefs. No login. No dashboard.
        </p>
        {/* Honest differentiation, secondary to the headline — stated
            once on this page. */}
        <p className="mx-auto mt-4 max-w-xl text-[13px] leading-relaxed text-zinc-400">
          AI can generate an analysis. Debrief structures the full workflow
          from Meta Ads data to a consistent buyer memo, client report, next
          tests, and creative briefs.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:mt-6">
          <Link href="/generator" className={`btn-sheen ${btnPrimary}`}>
            Debrief your ads
            <ArrowIcon className="h-4 w-4" />
          </Link>
          <Link href="/sample" className={btnSecondaryMd}>
            View sample report
          </Link>
        </div>
        <p className="mt-3.5 text-[13px] text-zinc-400 lg:mt-3">
          No CSV ready?{" "}
          <Link
            href="/sample"
            className="rounded-sm font-medium text-accent-soft underline decoration-accent/40 underline-offset-2 transition hover:decoration-accent"
          >
            Start with the sample report
          </Link>{" "}
          — see a full debrief before uploading anything.
        </p>
        <p className="mt-2.5 text-xs text-zinc-400">
          No login · Nothing stored server-side · Optional read-only Meta connection
        </p>

        {/* Live proof: the engine sorting real-shaped rows, on loop.
            Frameless — it floats on its own data surface. lg: tightens
            this gap on desktop/laptop so the demo clears the fold
            instead of sitting mostly below it. */}
        <div className="mx-auto mt-16 max-w-2xl text-left sm:mt-20 lg:mt-8">
          <HeroProof />
        </div>
      </section>

      {/* ---- How it works: asymmetric bento ---- */}
      <section className="mt-16" aria-label="How it works">
        <BlurFade>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            How it works
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
            Three steps from export to decision
          </h2>
        </BlurFade>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          {/* The three steps */}
          {STEPS.map((step, i) => (
            <BlurFade
              key={step.title}
              className={
                i === 2 ? "sm:col-span-2 lg:col-span-4" : "lg:col-span-4"
              }
              delay={i * 0.07}
            >
              <div className={`${card} ${cardHover} flex h-full flex-col p-5`}>
                <p className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/12 font-mono text-[10px] text-accent-soft">
                    {i + 1}
                  </span>
                  Step {i + 1}
                </p>
                <h3 className="mt-3 text-[14px] font-semibold tracking-tight text-zinc-100">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
                  {step.text}
                </p>
              </div>
            </BlurFade>
          ))}

          {/* Buyer memo */}
          <BlurFade className="lg:col-span-4" delay={0.14}>
            <div className={`${card} ${cardHover} flex h-full flex-col p-5`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                Out: buyer memo
              </p>
              <div className="mt-3.5">
                <MiniBuyerMemo />
              </div>
              <p className="mt-auto pt-4 text-[13px] leading-relaxed text-zinc-400">
                Decisions with numbers attached — scale, cut, test next, and
                briefs when you&apos;re ready to hand off.
              </p>
            </div>
          </BlurFade>

          {/* Client report */}
          <BlurFade className="lg:col-span-4" delay={0.21}>
            <div className={`${card} ${cardHover} flex h-full flex-col p-5`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                Out: client report
              </p>
              <div className="mt-3.5">
                <MiniClientReport />
              </div>
              <p className="mt-auto pt-4 text-[13px] leading-relaxed text-zinc-400">
                The same run in plain language, ready to send.
              </p>
            </div>
          </BlurFade>

          {/* Trust */}
          <BlurFade className="sm:col-span-2 lg:col-span-4" delay={0.28}>
            <div className={`${card} ${cardHover} flex h-full flex-col p-5`}>
              <p className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-zinc-100">
                <ShieldIcon className="h-4 w-4 text-accent-soft" />
                Private by architecture
              </p>
              <ul className="mt-3.5 space-y-2.5">
                {TRUST.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2 text-[12px] leading-relaxed text-zinc-400"
                  >
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-auto pt-4 text-[13px] leading-relaxed text-zinc-400">
                Rules, not a model — same input, same answer. There is no
                database to leak from.
              </p>
            </div>
          </BlurFade>
        </div>
      </section>

      {/* ---- The problem ---- */}
      <section
        className="animate-rise mx-auto mt-16 max-w-2xl text-center"
        style={{ animationDelay: "150ms" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          The problem
        </p>
        <p className="mt-4 text-xl font-medium leading-relaxed text-zinc-200 sm:text-2xl">
          Dashboards show numbers.{" "}
          <span className="text-zinc-400">
            Media buyers still have to decide what to do next.
          </span>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Debrief reads the same export you already have and answers the
          questions that actually end a reporting call: what worked, what
          failed, what to test next — and what to tell the client.
        </p>
      </section>

      {/* ---- Interactive proof: the KPI drives the ranking ---- */}
      <section className="mt-16" aria-label="Interactive KPI demo">
        <BlurFade>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            Try the judgement
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
            Pick the KPI — the ranking follows
          </h2>
        </BlurFade>
        <BlurFade className="mt-5" delay={0.07}>
          <KpiDemo />
        </BlurFade>
      </section>

      {/* ---- What you get ---- */}
      <section className="animate-rise mt-16" style={{ animationDelay: "210ms" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          What you get
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
          Decide, explain, brief — from the data you already have
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className={`${card} ${cardLift} p-5`}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/[0.06]">
                <benefit.icon className="h-4 w-4 text-accent-soft" />
              </div>
              <h3 className="mt-3.5 text-[14px] font-semibold tracking-tight text-zinc-100">
                {benefit.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
                {benefit.text}
              </p>
            </div>
          ))}
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
            <Link href="/generator" className={`btn-sheen ${btnPrimary}`}>
              Debrief your ads
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
