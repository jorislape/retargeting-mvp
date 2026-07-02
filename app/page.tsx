import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Design tokens — identical to /dashboard                            */
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
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 sm:w-auto";

const cardClasses =
  "rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl shadow-black/20 backdrop-blur";

function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-blue-500/20`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ height: "55%", width: "55%" }}
      >
        <path d="M21 2 13.5 12.5" />
        <path d="M21 2l-4 20-5-9-9-5 18-6z" />
      </svg>
    </div>
  );
}

function CheckIcon({
  className = "h-4 w-4 text-emerald-400",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

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
              Meta Retargeting
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
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow shadow-blue-600/25 transition hover:bg-blue-500 sm:px-4 sm:text-sm"
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* ====== HERO — one story: copy → CTA → connector → product ====== */}
      <section className="relative">
        {/* Glow + grid, sized down so they don't inflate mobile height */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl sm:h-[520px] sm:w-[880px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)] sm:bg-[size:64px_64px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-0 px-5 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-24">
          {/* Copy */}
          <div className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-300 sm:py-1.5 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Built on Meta&apos;s official Marketing API
            </div>

            <h1 className="mt-4 text-balance text-[34px] font-bold leading-[1.1] tracking-tight text-white sm:mt-6 sm:text-5xl lg:text-[56px] lg:leading-[1.08]">
              Launch Meta retargeting in{" "}
              <span className="bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">
                under a minute
              </span>
              .
            </h1>

            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-400 sm:mt-5 sm:text-lg">
              Pick an ad account, reuse a proven creative, set a budget — the
              custom audience, ad set, and ad are created for you. All paused
              until you approve.
            </p>

            {/* One primary action; secondary is a quiet text link */}
            <div className="mt-6 flex flex-col items-start gap-4 sm:mt-8 sm:flex-row sm:items-center">
              <Link href="/home" className={primaryCta}>
                Launch your first campaign
                <ArrowIcon />
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
                Launches paused by default
              </li>
              <li className="flex items-center gap-1.5">
                <CheckIcon className="h-3 w-3 text-emerald-400 sm:h-3.5 sm:w-3.5" />
                Never touches existing campaigns
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
          /*  the inner "Launch" element is a tinted illustration (not a  */
          /*  solid CTA) so nobody mistakes it for a clickable button.    */
          /* ----------------------------------------------------------- */}
          <figure className="relative mx-auto w-full max-w-sm pb-12 sm:pb-16 lg:pb-0">
            <div
              className="absolute -inset-6 rounded-3xl bg-blue-600/10 blur-2xl sm:-inset-8"
              aria-hidden="true"
            />

            {/* Entire mock is decorative: no pointer events, no a11y focus */}
            <div
              className={`relative select-none overflow-hidden ${cardClasses}`}
              aria-hidden="true"
            >
              {/* Window chrome → unmistakably a screenshot, not a control */}
              <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </span>
                <span className="ml-1 truncate text-[11px] font-medium text-zinc-500">
                  Dashboard preview
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Meta connected
                </span>
              </div>

              <div className="p-4 sm:p-5">
                <span className="text-[15px] font-semibold tracking-tight text-white sm:text-base">
                  Audience &amp; budget
                </span>

                <dl className="mt-3.5 space-y-2.5 border-t border-white/5 pt-3.5 text-[13px] sm:mt-4 sm:pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">Account</dt>
                    <dd className="font-mono text-[12px] text-zinc-200">
                      act_2017486418
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">Creative</dt>
                    <dd className="text-zinc-200">Summer Sale — Video</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">Audience</dt>
                    <dd className="text-zinc-200">Visitors, 30d</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">Budget</dt>
                    <dd className="text-zinc-200">€10 / day</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-zinc-500">Launch status</dt>
                    <dd>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        Paused
                      </span>
                    </dd>
                  </div>
                </dl>

                {/* Tinted, NON-interactive — clearly an illustration of the
                    in-app control, not a real button on this page */}
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-500/15 px-5 py-3 text-center text-[14px] font-semibold text-blue-200 sm:mt-5">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m13 2-2 10h6L11 22l2-10H7L13 2z" />
                  </svg>
                  Launch retargeting campaign
                </div>

                {/* Result row — stays in flow on mobile (no absolute clipping) */}
                <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-2 text-[12px] font-medium text-emerald-300">
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Audience + ad set + ad created — paused, €0 spent
                </div>
              </div>
            </div>

            <figcaption className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
              A preview of the dashboard — the real controls open inside.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ====== HOW IT WORKS — moved up: activation before reassurance ====== */}
      <section id="how-it-works" className="border-t border-white/5 bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-center sm:text-3xl">
            From zero to launched in three steps
          </h2>

          {/* Mobile: vertical timeline · Desktop: three columns */}
          <ol className="relative mt-8 space-y-6 sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-5 sm:space-y-0">
            <div
              className="absolute bottom-8 left-[15px] top-2 w-px bg-gradient-to-b from-blue-500/40 via-white/10 to-transparent sm:hidden"
              aria-hidden="true"
            />
            <Step
              number={1}
              title="Connect Meta"
              text="Secure OAuth login — we never see your password. Your ad account, campaign, and pixel are detected automatically."
            />
            <Step
              number={2}
              title="Pick creative & budget"
              text="Reuse an existing ad or write a new one, choose the visitor window (7 / 14 / 30 days) and a daily budget."
            />
            <Step
              number={3}
              title="Review & activate"
              text="The full retargeting structure appears in Ads Manager, paused. Flip it on when you're ready."
            />
          </ol>

          <div className="mt-8 sm:mt-10 sm:text-center">
            <Link href="/home" className={primaryCta}>
              Try it now
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* ====== VALUE / FEATURES ====== */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-center sm:text-3xl">
            Retargeting setup, minus the busywork
          </h2>
          <p className="mt-2.5 max-w-xl text-[15px] text-zinc-400 sm:mx-auto sm:mt-3 sm:text-center sm:text-base">
            For freelancers, media buyers, and small agencies who build the
            same retargeting structure for every client.
          </p>

          <div className="mt-8 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-3">
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m13 2-2 10h6L11 22l2-10H7L13 2z" />
                </svg>
              }
              title="One click, three assets"
              text="Custom audience, ad set, and ad — the exact structure you'd build by hand in Ads Manager, created together in seconds."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <path d="M21 3v6h-6" />
                </svg>
              }
              title="Reuse winning creatives"
              text="Point at an existing ad and its creative is reused for the retargeting audience — with a live Facebook-feed preview before launch."
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                </svg>
              }
              title="Safe by default"
              text="Everything launches paused and existing campaigns are never modified. You review and activate in Ads Manager."
            />
          </div>
        </div>
      </section>

      {/* ====== ACCOUNT SAFETY ====== */}
      <section id="safety" className="border-t border-white/5 bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Account safety
              </div>
              <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-white sm:mt-3 sm:text-3xl">
                Your client accounts stay untouched.
              </h2>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-zinc-400 sm:mt-4 sm:text-base">
                We know you&apos;re often running someone else&apos;s money.
                That&apos;s why the tool is read-and-create only — it can&apos;t
                edit, pause, or delete anything that already exists in the
                account.
              </p>
            </div>

            <div className={`${cardClasses} p-5 sm:p-6`}>
              <ul className="space-y-4 text-[14px] text-zinc-200 sm:text-[15px]">
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-emerald-400" />
                  <div>
                    Existing campaigns and ads are never modified
                    <p className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">
                      Only new assets are created, inside a campaign you choose.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-emerald-400" />
                  <div>
                    Everything launches in paused status
                    <p className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">
                      Zero spend until you activate it yourself in Ads Manager.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckIcon className="mt-1 h-4 w-4 text-emerald-400" />
                  <div>
                    Full control stays in Meta
                    <p className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">
                      Every created asset is visible, editable, and deletable
                      in Ads Manager.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FAQ ====== */}
      <section id="faq" className="border-t border-white/5">
        <div className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-center sm:text-3xl">
            Questions, answered
          </h2>

          <div className="mt-7 space-y-3 sm:mt-10">
            <FaqItem
              q="Can this break my ad account?"
              a="No. The tool only creates new assets — a custom audience, an ad set, and an ad — inside a campaign you choose. It never edits or deletes anything that already exists, and everything is created in paused status."
            />
            <FaqItem
              q="Will it start spending money?"
              a="Not until you say so. Every launch is created paused. You review the setup in Meta Ads Manager and activate it manually."
            />
            <FaqItem
              q="What do I need to get started?"
              a="A Meta ad account with at least one campaign and an active pixel. Connect with OAuth and the dashboard detects the rest automatically."
            />
            <FaqItem
              q="Who is this for?"
              a="Freelancers, media buyers, SMMA teams, and small agencies that set up the same website-retargeting structure again and again for clients."
            />
          </div>
        </div>
      </section>

      {/* ====== FINAL CTA ====== */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-950/60 to-zinc-900 px-6 py-10 text-center shadow-2xl shadow-black/40 sm:rounded-3xl sm:px-8 sm:py-14">
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[480px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl"
              aria-hidden="true"
            />
            <h2 className="relative text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              Your next retargeting campaign, one click away.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-[15px] text-zinc-400 sm:mt-4 sm:text-base">
              Free during beta. Launches paused. Nothing spends without your
              approval.
            </p>
            <div className="relative mt-6 sm:mt-8">
              <Link href="/home" className={primaryCta}>
                Open the dashboard
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm text-zinc-500 sm:px-6 sm:py-8">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold text-zinc-300">
              Meta Retargeting
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Beta
            </span>
          </div>
          <p className="text-xs">
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
    <div className={`${cardClasses} p-5 transition hover:border-white/20 sm:p-6`}>
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
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3.5 transition hover:border-white/20 sm:px-5 sm:py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-white sm:text-[15px]">
        {q}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-400 sm:text-sm">{a}</p>
    </details>
  );
}
