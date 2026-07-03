import Link from "next/link";
import { Reveal, SpotlightCard } from "@/components/landing/fx";
import { LogoMark } from "@/components/ui/brand";
import {
  ArrowIcon,
  BarChartIcon,
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  SendIcon,
} from "@/components/ui/icons";

/* ------------------------------------------------------------------ */
/*  Design tokens — identical to the app shell (components/ui/theme)   */
/*  bg: zinc-950 · cards: zinc-900/60 + border-white/10                */
/*  accent: blue-600 · success: emerald · paused: amber                */
/*                                                                     */
/*  Mobile-first rules used throughout:                                */
/*  - one primary CTA per viewport; secondary actions are text links   */
/*  - section rhythm: py-12 mobile → py-20 desktop                     */
/*  - no absolute-positioned decoration that can clip on narrow vw     */
/*                                                                     */
/*  Affordance rule:                                                   */
/*  - SOLID blue (primaryCta / nav button) = a real, clickable action  */
/*  - tinted blue inside a framed "preview" = illustration, NOT a btn  */
/* ------------------------------------------------------------------ */

const primaryCta =
  "group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 sm:w-auto";

const primaryCtaArrow =
  "h-4 w-4 transition-transform group-hover:translate-x-0.5";

const cardClasses =
  "rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl shadow-black/20 backdrop-blur";

/* Deterministic "daily spend" bars for the hero preview — an upward
   month with natural variance, last day accented. Illustration only. */
const SPEND_BARS = [34, 48, 40, 56, 46, 60, 52, 66, 58, 72, 64, 80, 74, 92];

/* Example alerts for the monitoring ticker — explicitly labelled as
   examples in the UI; none of this claims to be live data. */
const TICKER_ITEMS: { tone: "amber" | "red" | "emerald" | "sky"; text: string }[] = [
  { tone: "amber", text: "CPA spike +38% — Aurora Skincare" },
  { tone: "red", text: "Ad rejected — policy review needed" },
  { tone: "sky", text: "Delivery drop −52% — Retargeting · EU" },
  { tone: "emerald", text: "ROAS 5.1x — best week this quarter" },
  { tone: "amber", text: "Spend pacing 120% of daily budget" },
  { tone: "emerald", text: "CPA recovered — back under target" },
  { tone: "sky", text: "New ad set live — Prospecting · US" },
  { tone: "red", text: "Payment issue on ad account" },
];

const TICKER_DOT: Record<(typeof TICKER_ITEMS)[number]["tone"], string> = {
  amber: "bg-amber-400",
  red: "bg-red-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100 antialiased">
      {/* ====== NAV ====== */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoMark />
            <span className="truncate text-sm font-bold tracking-tight text-white">
              AdReports
            </span>
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 sm:inline">
              Beta
            </span>
          </div>

          <nav className="flex items-center gap-5">
            <a
              href="#how-it-works"
              className="hidden text-sm text-zinc-400 transition hover:text-white md:inline"
            >
              How it works
            </a>
            <a
              href="#safety"
              className="hidden text-sm text-zinc-400 transition hover:text-white md:inline"
            >
              Account safety
            </a>
            <a
              href="#faq"
              className="hidden text-sm text-zinc-400 transition hover:text-white md:inline"
            >
              FAQ
            </a>
            <Link
              href="/home"
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow shadow-blue-600/25 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 sm:px-4 sm:text-sm"
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* ====== HERO — one story: copy → CTA → connector → product ====== */}
      <section className="relative">
        {/* Glow + grid, sized down so they don't inflate mobile height.
            Two counter-drifting aurora blobs; static under reduced motion. */}
        <div
          className="animate-drift pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl sm:h-[520px] sm:w-[880px]"
          aria-hidden="true"
        />
        <div
          className="animate-drift-2 pointer-events-none absolute -right-24 top-44 hidden h-[380px] w-[560px] rounded-full bg-sky-500/10 blur-3xl lg:block"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)] sm:bg-[size:64px_64px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-0 px-5 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-24">
          {/* Copy */}
          <div className="animate-rise mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-300 sm:py-1.5 sm:text-xs">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
              </span>
              Read-only · Built on Meta&apos;s official Marketing API
            </div>

            <h1 className="mt-4 text-balance text-[34px] font-bold leading-[1.1] tracking-tight text-white sm:mt-6 sm:text-5xl lg:text-[56px] lg:leading-[1.08]">
              Meta Ads client reports,{" "}
              <span className="animate-shimmer bg-gradient-to-r from-sky-300 via-blue-500 to-sky-300 bg-clip-text text-transparent">
                on autopilot
              </span>
              .
            </h1>

            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-400 sm:mt-5 sm:text-lg">
              Connect your ad accounts once. Every client gets a live report
              link and a scheduled summary — and you get pinged before the
              client notices something broke.
            </p>

            {/* One primary action; secondary is a quiet text link */}
            <div className="mt-6 flex flex-col items-start gap-4 sm:mt-8 sm:flex-row sm:items-center">
              <Link href="/home" className={primaryCta}>
                Connect your Meta account
                <ArrowIcon className={primaryCtaArrow} />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white"
              >
                See how it works
                <ArrowIcon className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Compact trust strip — visible without scrolling */}
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-zinc-400 sm:mt-8 sm:gap-x-6 sm:gap-y-2 sm:text-sm">
              <li className="flex items-center gap-1.5">
                <CheckIcon className="h-3 w-3 text-emerald-400 sm:h-3.5 sm:w-3.5" />
                Read-only — can&apos;t touch campaigns
              </li>
              <li className="flex items-center gap-1.5">
                <CheckIcon className="h-3 w-3 text-emerald-400 sm:h-3.5 sm:w-3.5" />
                No credit card
              </li>
              <li className="flex items-center gap-1.5">
                <CheckIcon className="h-3 w-3 text-emerald-400 sm:h-3.5 sm:w-3.5" />
                Free during beta
              </li>
            </ul>
          </div>

          {/* Connector — ties the CTA to the product on mobile */}
          <div
            className="mx-auto mt-6 h-10 w-px bg-gradient-to-b from-blue-500/60 to-transparent lg:hidden"
            aria-hidden="true"
          />

          {/* ----------------------------------------------------------- */
          /*  Product proof — a LABELLED, NON-INTERACTIVE preview.        */
          /*  Window chrome + caption make it read as a screenshot, and   */
          /*  the inner "Send report" element is a tinted illustration    */
          /*  (not a solid CTA) so nobody mistakes it for a real button.  */
          /* ----------------------------------------------------------- */}
          <figure className="animate-rise relative mx-auto w-full max-w-sm pb-12 [animation-delay:120ms] sm:pb-16 lg:pb-0">
            <div
              className="absolute -inset-6 rounded-3xl bg-blue-600/10 blur-2xl sm:-inset-8"
              aria-hidden="true"
            />

            {/* Entire mock is decorative: no pointer events, no a11y focus */}
            <div
              className={`animate-float relative select-none overflow-hidden ${cardClasses}`}
              aria-hidden="true"
            >
              {/* Light pulse traveling along the top edge — "it's running" */}
              <span className="animate-beam-x absolute left-0 top-0 h-px w-1/3 bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />

              {/* Window chrome → unmistakably a screenshot, not a control */}
              <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </span>
                <span className="ml-1 truncate text-[11px] font-medium text-zinc-500">
                  Client report preview
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Meta connected
                </span>
              </div>

              <div className="p-4 sm:p-5">
                <span className="text-[15px] font-semibold tracking-tight text-white sm:text-base">
                  Aurora Skincare — June
                </span>

                <dl className="mt-3.5 space-y-2.5 border-t border-white/5 pt-3.5 text-[13px] sm:mt-4 sm:pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">Account</dt>
                    <dd className="font-mono text-[12px] text-zinc-200">
                      act_2017486418
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">ROAS</dt>
                    <dd className="text-zinc-200">
                      4.2x{" "}
                      <span className="text-[11px] font-medium text-emerald-300">
                        ▲ 18%
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">CPA</dt>
                    <dd className="text-zinc-200">
                      €11.20{" "}
                      <span className="text-[11px] font-medium text-emerald-300">
                        ▼ 9%
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">Next report</dt>
                    <dd>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        Scheduled · Mon 09:00
                      </span>
                    </dd>
                  </div>
                </dl>

                {/* Mini spend chart — makes the preview read as a live report */}
                <div className="mt-4 border-t border-white/5 pt-3.5">
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="font-semibold uppercase tracking-wider text-zinc-500">
                      Daily spend · €12,480
                    </span>
                    <span className="text-zinc-500">Jun 1–30</span>
                  </div>
                  <div className="mt-2 flex h-10 items-end gap-[3px]">
                    {SPEND_BARS.map((height, i) => (
                      <span
                        key={i}
                        style={{
                          height: `${height}%`,
                          animationDelay: `${0.35 + i * 0.045}s`,
                        }}
                        className={`animate-grow-bar min-w-0 flex-1 rounded-sm ${
                          i === SPEND_BARS.length - 1
                            ? "bg-blue-400"
                            : "bg-blue-500/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Tinted, NON-interactive — clearly an illustration of the
                    in-app control, not a real button on this page */}
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/15 px-5 py-3 text-center text-[14px] font-semibold text-blue-200 sm:mt-5">
                  <SendIcon className="h-4 w-4" />
                  Send report to client
                </div>

                {/* Result row — stays in flow on mobile (no absolute clipping);
                    arrives ~1.6s after load so the preview tells a story */}
                <div className="animate-toast-in mt-3 flex items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-2 text-[12px] font-medium text-emerald-300">
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Report sent — summary went out unedited
                </div>
              </div>
            </div>

            <figcaption className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
              A preview of a client report — your clients get it as a live
              link.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ====== TRUST BAND — honest numbers, no fake logos ====== */}
      <section className="border-t border-white/5">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:grid-cols-3 sm:gap-8 sm:px-6 sm:py-10">
          <Reveal>
            <TrustStat
              value="2 minutes"
              label="from connecting Meta to your first client report"
            />
          </Reveal>
          <Reveal delay={120}>
            <TrustStat
              value="100% read-only"
              label="the ads_read scope can't modify campaigns or spend"
            />
          </Reveal>
          <Reveal delay={240}>
            <TrustStat
              value="24/7 monitoring"
              label="every account checked hourly for anomalies"
            />
          </Reveal>
        </div>
      </section>

      {/* ====== MONITORING TICKER — example alerts, stock-ticker style ====== */}
      <section className="border-t border-white/5 bg-zinc-900/20">
        <p className="sr-only">
          Examples of alerts monitoring surfaces: CPA spikes, rejected ads,
          delivery drops, budget pacing, and payment issues.
        </p>
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-5 py-3.5 sm:px-6">
          <span className="hidden shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:flex">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Monitoring · examples
          </span>
          <div className="ticker-wrap min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            <div className="animate-ticker flex w-max" aria-hidden="true">
              <TickerRow />
              <TickerRow className="ticker-dupe" />
            </div>
          </div>
        </div>
      </section>

      {/* ====== HOW IT WORKS — activation before reassurance ====== */}
      {/* scroll-mt offsets the sticky h-14 header on all anchored sections */}
      <section
        id="how-it-works"
        className="scroll-mt-14 border-t border-white/5 bg-zinc-900/30"
      >
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <Reveal>
            <SectionHeader
              kicker="How it works"
              title="From connect to client-ready in three steps"
            />
          </Reveal>

          {/* Mobile: vertical timeline · Desktop: three columns */}
          <ol className="relative mt-8 space-y-6 sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-5 sm:space-y-0">
            <div
              className="absolute bottom-8 left-[15px] top-2 w-px bg-gradient-to-b from-blue-500/40 via-white/10 to-transparent sm:hidden"
              aria-hidden="true"
            />
            <Step
              number={1}
              title="Connect Meta"
              text="Read-only OAuth — no password shared. Every ad account you manage appears automatically."
            />
            <Step
              number={2}
              title="Pick accounts & schedule"
              text="Map accounts to clients and set a weekly or monthly delivery schedule per report."
            />
            <Step
              number={3}
              title="Reports run themselves"
              text="Clients get a live link and a scheduled summary. Monitoring pings you when something breaks."
            />
          </ol>

          <Reveal delay={150} className="mt-8 sm:mt-10 sm:text-center">
            <Link href="/home" className={primaryCta}>
              Try it now
              <ArrowIcon className={primaryCtaArrow} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ====== VALUE / FEATURES ====== */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <Reveal>
            <SectionHeader
              kicker="Why AdReports"
              title="Client reporting, minus the busywork"
              subtitle="For freelance media buyers and small agencies who lose half a day per client to Ads Manager exports and spreadsheets."
            />
          </Reveal>

          <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-3">
            <Reveal className="h-full">
              <FeatureCard
                icon={<FileTextIcon className="h-5 w-5" />}
                title="Reports that send themselves"
                text="A live link and a scheduled email per client — KPIs, deltas, trends, and a summary good enough to send unedited."
              />
            </Reveal>
            <Reveal delay={120} className="h-full">
              <FeatureCard
                icon={<BellIcon className="h-5 w-5" />}
                title="Always-on monitoring"
                text="CPA spikes, rejected ads, delivery drops — you know before the client does."
              />
            </Reveal>
            <Reveal delay={240} className="h-full">
              <FeatureCard
                icon={<BarChartIcon className="h-5 w-5" />}
                title="Meta-native depth"
                text="Real breakdowns, campaign tables, and honest period comparisons — not a generic widget grid."
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ====== ACCOUNT SAFETY ====== */}
      <section
        id="safety"
        className="scroll-mt-14 border-t border-white/5 bg-zinc-900/30"
      >
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2">
            <Reveal>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Account safety
              </div>
              <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:mt-3 sm:text-3xl">
                Read-only. Your client accounts stay untouched.
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-zinc-400 sm:mt-4 sm:text-base">
                You&apos;re running someone else&apos;s money. That&apos;s why
                AdReports asks Meta for read-only access — it can report on
                anything and change nothing.
              </p>
            </Reveal>

            <Reveal delay={150} className={`${cardClasses} p-5 sm:p-6`}>
              <ul className="space-y-4 text-[14px] text-zinc-200 sm:text-[15px]">
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-emerald-400" />
                  <div>
                    Read-only by design
                    <p className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">
                      The permission we request (ads_read) physically cannot
                      edit, pause, or delete campaigns.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-emerald-400" />
                  <div>
                    No surprise spend
                    <p className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">
                      Nothing the tool does can start, stop, or change
                      spending — ever.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-emerald-400" />
                  <div>
                    Revoke anytime
                    <p className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">
                      Disconnect in one click from Settings, or from your Meta
                      Business security page.
                    </p>
                  </div>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ====== FAQ ====== */}
      <section id="faq" className="scroll-mt-14 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-20">
          <Reveal>
            <SectionHeader kicker="FAQ" title="Questions, answered" />
          </Reveal>

          <Reveal delay={120} className="mt-7 space-y-3 sm:mt-10">
            <FaqItem
              q="Can this touch my ad accounts?"
              a="No. AdReports uses Meta's read-only ads_read permission — it can read performance data, and nothing else."
            />
            <FaqItem
              q="What do my clients see?"
              a="A clean live report link — no login needed — plus an optional scheduled email. Each client only ever sees their own accounts."
            />
            <FaqItem
              q="What do I need to get started?"
              a="A Meta login with access to your clients' ad accounts. Connect, pick accounts, and your first report is ready in about two minutes."
            />
            <FaqItem
              q="Which platforms are supported?"
              a="Meta Ads today — Facebook and Instagram at full native depth. Google Ads is next on the roadmap."
            />
            <FaqItem
              q="What does it cost?"
              a="Free during beta. After that, simple per-client pricing — no per-seat fees, no per-connector fees, no five-client minimum."
            />
          </Reveal>
        </div>
      </section>

      {/* ====== FINAL CTA ====== */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <Reveal className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-950/60 to-zinc-900 px-6 py-10 text-center shadow-2xl shadow-black/40 sm:rounded-3xl sm:px-8 sm:py-14">
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[480px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl"
              aria-hidden="true"
            />
            <h2 className="relative text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Your next client report is two minutes away.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-[15px] text-zinc-400 sm:mt-4 sm:text-base">
              Free during beta. Read-only access. Disconnect anytime.
            </p>
            <div className="relative mt-6 sm:mt-8">
              <Link href="/home" className={primaryCta}>
                Open the dashboard
                <ArrowIcon className={primaryCtaArrow} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="text-sm font-semibold text-zinc-300">
                AdReports
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Beta
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
              <a href="#how-it-works" className="transition hover:text-white">
                How it works
              </a>
              <a href="#safety" className="transition hover:text-white">
                Account safety
              </a>
              <a href="#faq" className="transition hover:text-white">
                FAQ
              </a>
              <Link href="/privacy" className="transition hover:text-white">
                Privacy
              </Link>
            </nav>
          </div>
          <p className="mt-6 border-t border-white/5 pt-5 text-xs text-zinc-500">
            Built on Meta&apos;s official Marketing API. Not affiliated with
            Meta Platforms, Inc.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Section pieces                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-center">
        {kicker}
      </p>
      <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:text-center sm:text-3xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2.5 max-w-xl text-[15px] text-zinc-400 sm:mx-auto sm:mt-3 sm:text-center sm:text-base">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* One pass of ticker chips. Rendered twice (second copy = .ticker-dupe)
   so the -50% translate loop is seamless; pr matches the inner gap. */
function TickerRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 pr-3 ${className}`}>
      {TICKER_ITEMS.map((item) => (
        <span
          key={item.text}
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${TICKER_DOT[item.tone]}`}
          />
          {item.text}
        </span>
      ))}
    </div>
  );
}

function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="sm:text-center">
      <p className="text-lg font-bold tracking-tight text-white sm:text-xl">
        {value}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-500 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: number;
  title: string;
  text: string;
}) {
  return (
    <li className="relative flex gap-4 sm:block sm:rounded-2xl sm:border sm:border-white/10 sm:bg-zinc-900/60 sm:p-6 sm:shadow-xl sm:shadow-black/20">
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-zinc-950 text-sm font-bold text-blue-300 sm:bg-blue-500/10">
        {number}
      </div>
      <div className="pt-0.5 sm:pt-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-white sm:mt-4 sm:text-lg">
          {title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-400 sm:mt-2 sm:text-sm">
          {text}
        </p>
      </div>
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <SpotlightCard
      className={`${cardClasses} h-full p-5 transition hover:border-white/20 sm:p-6`}
    >
      <div className="flex items-start gap-4 sm:block">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300 sm:h-10 sm:w-10">
          {icon}
        </div>
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-white sm:mt-4 sm:text-lg">
            {title}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-400 sm:mt-2 sm:text-sm">
            {text}
          </p>
        </div>
      </div>
    </SpotlightCard>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3.5 transition hover:border-white/20 sm:px-5 sm:py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-white sm:text-[15px]">
        {q}
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-400 sm:text-sm">{a}</p>
    </details>
  );
}
