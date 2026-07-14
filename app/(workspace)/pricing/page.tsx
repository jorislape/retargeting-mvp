import { GaugeIcon, ShieldIcon, ZapIcon } from "@/components/ui/icons";
import {
  card,
  cardLift,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: "Pricing",
  description:
    "Debrief is free to use today. No billing is live yet — see what's planned and what stays free.",
  alternates: { canonical: "/pricing" },
};

const TIERS = [
  {
    name: "Free",
    status: "Available now",
    icon: ZapIcon,
    description:
      "The full debrief workflow: CSV or Meta OAuth data, buyer memo, client report, competitor debrief, creative briefs, PDF export. No account, no limits imposed today.",
    points: [
      "No login required",
      "Ads data never stored server-side",
      "Unlimited debriefs, this session",
    ],
  },
  {
    name: "Team",
    status: "Coming soon",
    icon: GaugeIcon,
    description:
      "For agencies and in-house teams running this across multiple accounts. Scope isn't finalized — likely a saved-learnings workspace and shared account context.",
    points: [
      "Planned: structured learnings across accounts",
      "Planned: shared context between teammates",
      "Not built yet — no billing integration exists",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Pricing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>Free today.</span> No billing live
          yet.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          Debrief has no payment system connected. Everything described on
          this site is free to use right now. The tiers below are a preview
          of direction, not a commitment to a date or a price.
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {TIERS.map((tier, i) => (
          <section
            key={tier.name}
            className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
            style={{ animationDelay: `${90 + i * 90}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
                <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
                  <tier.icon className="h-3.5 w-3.5" />
                </span>
                {tier.name}
              </h2>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                {tier.status}
              </span>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
              {tier.description}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-400">
              {tier.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section
        className={`animate-rise mt-3 ${card} p-5 sm:p-6`}
        style={{ animationDelay: "270ms" }}
      >
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
          <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
            <ShieldIcon className="h-3.5 w-3.5" />
          </span>
          Want to know when Team ships?
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
          There&rsquo;s no mailing list or signup form yet. Email{" "}
          <a
            href="mailto:joris.adomas@gmail.com?subject=Debrief%20Team%20tier"
            className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
          >
            joris.adomas@gmail.com
          </a>{" "}
          and you&rsquo;ll hear when it&rsquo;s ready.
        </p>
      </section>
    </div>
  );
}
