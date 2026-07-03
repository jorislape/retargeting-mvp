import { Reveal } from "@/components/landing/fx";
import { CheckIcon, FileTextIcon, FlaskIcon, SparklesIcon } from "@/components/ui/icons";

const STEPS = [
  { icon: FileTextIcon, title: "Upload your CSV", text: "Export from Ads Manager, drop it in." },
  { icon: SparklesIcon, title: "Set KPI & context", text: "Pick what matters, add a line of context." },
  { icon: FlaskIcon, title: "Get your debrief", text: "Winners, losers, patterns, next tests." },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-3xl sm:h-[440px] sm:w-[780px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl px-5 pt-14 text-center sm:px-6 sm:pt-20">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            No login. Nothing stored. Your CSV never leaves this session.
          </div>

          <h1 className="mt-6 text-balance text-[32px] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Upload your Meta Ads history.{" "}
            <span className="bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">
              Get your next creative tests.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400 sm:text-lg">
            A decision-first debrief showing what worked, what failed, and
            what to test next — written like a senior media buyer did it in
            ten minutes.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mx-auto mt-9 grid max-w-2xl gap-3 sm:grid-cols-3 sm:gap-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 text-left sm:flex-col sm:gap-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-500/10 text-blue-300">
                  <step.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={200}>
          <ul className="mx-auto mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-zinc-500">
            <li className="flex items-center gap-1.5">
              <CheckIcon className="h-3 w-3 text-emerald-400" />
              Deterministic scoring, not a black box
            </li>
            <li className="flex items-center gap-1.5">
              <CheckIcon className="h-3 w-3 text-emerald-400" />
              Free, no account needed
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
