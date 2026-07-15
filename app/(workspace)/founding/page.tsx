import {
  FileTextIcon,
  FlaskIcon,
  GaugeIcon,
  HelpCircleIcon,
  ShieldIcon,
  ZapIcon,
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
  title: "Founding agencies",
  description:
    "Debrief is opening 10 founding-agency spots: real client work, direct roadmap input, and founding pricing locked in before the public Agency plan launches.",
  alternates: { canonical: "/founding" },
};

const CALL_MAILTO =
  "mailto:joris.adomas@gmail.com?subject=Debrief%20founding%20agency%20call";
const EMAIL_MAILTO = "mailto:joris.adomas@gmail.com";

const GET = [
  "White-label client reports",
  "Direct roadmap input",
  "Early access to structured learnings/workspace when it ships",
  "Founding pricing protected while the account remains active",
] as const;

const WHO_FOR = [
  "Performance marketing agencies",
  "Freelance media buyers",
  "In-house growth teams",
  "Consultants managing paid social accounts",
] as const;

const NOT_PROMISED = [
  "No guaranteed ROAS",
  "No automatic scaling",
  "No black-box AI recommendations",
  "No promise that every planned feature has a fixed delivery date",
] as const;

const STEPS = [
  { icon: HelpCircleIcon, text: "Book a short call" },
  { icon: FlaskIcon, text: "Run Debrief on one real account" },
  { icon: FileTextIcon, text: "Review the output together" },
  { icon: GaugeIcon, text: "Decide whether the founding arrangement fits" },
] as const;

const FAQ = [
  {
    q: "Why only 10?",
    a: "Ten is what one person can onboard and support well while this is still a manual process — not a marketing number.",
  },
  {
    q: "Does the free product stay available?",
    a: "Yes. The free tool — CSV or Meta data in, buyer memo, client report, competitor debrief, white-label reports, PDF export — stays free and unlimited for everyone, whether or not you join the founding program.",
  },
  {
    q: "What happens when the future Agency/Team workspace launches?",
    a: "Founding agencies get early access and input into what it becomes, plus locked-in pricing once it launches. Scope and timeline aren't fixed yet — see /pricing for where that stands.",
  },
  {
    q: "Is payment live today?",
    a: "Not yet. The founding program starts with a short conversation and a manual agreement. Hosted payment links will be added once the first cohort is confirmed.",
  },
] as const;

export default function FoundingPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Founding program</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Become one of Debrief&rsquo;s{" "}
          <span className={gradientText}>first 10 founding agencies.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          Use Debrief on real client work, help shape what gets built next,
          and lock in founding pricing before the public Agency plan
          launches.
        </p>
        <div
          className="animate-rise mt-6 flex flex-wrap items-center gap-3"
          style={{ animationDelay: "60ms" }}
        >
          <a href={CALL_MAILTO} className={btnPrimary}>
            Book a short call
          </a>
          <a href={EMAIL_MAILTO} className={btnSecondaryMd}>
            Email me
          </a>
        </div>
      </header>

      <div className="mt-8 space-y-3">
        <section
          className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
          style={{ animationDelay: "150ms" }}
        >
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
            <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
              <ZapIcon className="h-3.5 w-3.5" />
            </span>
            What founding agencies get
          </h2>
          <ul className="mt-4 space-y-1.5 text-sm text-zinc-400">
            {GET.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600"
                />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
          style={{ animationDelay: "210ms" }}
        >
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
            <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
              <GaugeIcon className="h-3.5 w-3.5" />
            </span>
            Who it&rsquo;s for
          </h2>
          <ul className="mt-4 space-y-1.5 text-sm text-zinc-400">
            {WHO_FOR.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600"
                />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
          style={{ animationDelay: "270ms" }}
        >
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
            <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
              <ShieldIcon className="h-3.5 w-3.5" />
            </span>
            What it&rsquo;s not
          </h2>
          <ul className="mt-4 space-y-1.5 text-sm text-zinc-400">
            {NOT_PROMISED.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600"
                />
                {point}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="animate-rise mt-12" style={{ animationDelay: "330ms" }}>
        <p className={eyebrow}>How it works</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
          Four steps, one conversation at a time
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.text} className={`${card} p-4`}>
              <div className="flex items-center justify-between">
                <div className={`h-8 w-8 ${iconChip}`}>
                  <step.icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-mono text-[11px] font-semibold text-zinc-400">
                  0{i + 1}
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="animate-rise mt-12" style={{ animationDelay: "390ms" }}>
        <p className={eyebrow}>FAQ</p>
        <h2 className="mt-2 flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white">
          <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
            <HelpCircleIcon className="h-3.5 w-3.5" />
          </span>
          Common questions
        </h2>
        <div className={`mt-4 ${card} divide-y divide-white/[0.06]`}>
          {FAQ.map((item) => (
            <div key={item.q} className="px-5 py-4">
              <p className="text-sm font-semibold text-white">{item.q}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="animate-rise mt-12 text-center"
        style={{ animationDelay: "450ms" }}
      >
        <div className={`${card} px-6 py-10 sm:py-12`}>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            See whether Debrief{" "}
            <span className={gradientText}>fits your workflow.</span>
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a href={CALL_MAILTO} className={btnPrimary}>
              Book a short call
            </a>
            <a href={EMAIL_MAILTO} className={btnSecondaryMd}>
              Email me
            </a>
          </div>
          <p className="mx-auto mt-5 max-w-md text-xs leading-relaxed text-zinc-500">
            No booking link yet — either button opens an email to{" "}
            <a
              href={EMAIL_MAILTO}
              className="rounded-sm underline decoration-zinc-700 underline-offset-2 transition hover:text-zinc-300 hover:decoration-zinc-400"
            >
              joris.adomas@gmail.com
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
