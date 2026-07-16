import type { ReactNode } from "react";
import Link from "next/link";
import { FileTextIcon, FlaskIcon, GaugeIcon, ShieldIcon, SparklesIcon } from "@/components/ui/icons";
import {
  card,
  cardLift,
  cardNested,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: { absolute: "Debrief vs. ChatGPT, Claude & Gemini" },
  description:
    "ChatGPT, Claude, and Gemini can all analyze ad data if you prompt them well. Here's what Debrief does differently: a repeatable workflow, published rules, structured output, a stated privacy boundary, and how each provider's default data-handling policy compares.",
  alternates: { canonical: "/vs-chatgpt" },
};

/* ------------------------------------------------------------------ */
/* Approved consumer-plan policy facts, verified 2026-07-14. Do not     */
/* add, broaden, or reinterpret beyond what's written here — see       */
/* docs/REVERIFY.md for the source list and the re-verification        */
/* checklist that keeps this table honest over time.                   */
/* ------------------------------------------------------------------ */
const AI_POLICY_ROWS = [
  {
    name: "ChatGPT",
    points: [
      "Model improvement is enabled by default on consumer plans, with an opt-out available in settings.",
      "Deleted chats are normally removed within about 30 days.",
      "A 2025 court order required retention of deleted consumer chats; that preservation obligation ended September 26, 2025.",
    ],
    sources: [
      { label: "OpenAI privacy policy", url: "https://openai.com/policies/row-privacy-policy/" },
      { label: "OpenAI's response to the NYT data demands", url: "https://openai.com/index/response-to-nyt-data-demands/" },
    ],
  },
  {
    name: "Claude",
    points: [
      "Consumer-plan training became opt-out (default-on) in August 2025.",
      "Retention may extend up to 5 years while model improvement stays enabled.",
      "Retention is 30 days when opted out, subject to documented safety exceptions.",
    ],
    sources: [
      { label: "Anthropic: updates to our consumer terms", url: "https://www.anthropic.com/news/updates-to-our-consumer-terms" },
      { label: "How long do you store my data?", url: "https://privacy.claude.com/en/articles/10023548-how-long-do-you-store-my-data" },
    ],
  },
  {
    name: "Gemini",
    points: [
      "Keep Activity is on by default for consumer accounts.",
      "Human-reviewed chats may be retained for up to 3 years, separately from account activity.",
      "Google advises against entering confidential information you wouldn't want a reviewer to see.",
    ],
    sources: [
      { label: "Gemini Apps privacy help", url: "https://support.google.com/gemini/answer/13594961" },
    ],
  },
] as const;

function PolicySourceLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      aria-label={`${label} — open source (${url})`}
      className="text-accent-soft underline decoration-accent-soft/30 underline-offset-2 transition hover:decoration-accent-soft"
    >
      {label}
    </a>
  );
}

const DIFFERENCES: { icon: typeof GaugeIcon; title: string; body: ReactNode }[] = [
  {
    icon: GaugeIcon,
    title: "Published, fixed rules — not a prompt",
    body: (
      <>
        Spend gates, medians, and confidence thresholds are code — see{" "}
        <Link
          href="/how-it-works"
          className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
        >
          how the rules work
        </Link>
        . A prompt that produces a good analysis today can produce a
        different one next time you run it, or when the model changes.
        Debrief&rsquo;s rules don&rsquo;t drift, and you can check the math
        yourself instead of trusting a paraphrase. Chat tools can write and
        run Python, and the arithmetic in that executed code can be exact —
        that&rsquo;s not the difference. The difference is methodology:
        which analysis gets written, which thresholds get picked, and what
        counts as a winner can vary across prompts, runs, and model
        versions. Debrief fixes that methodology once and publishes it,
        instead of deciding it fresh each time.
      </>
    ),
  },
  {
    icon: FileTextIcon,
    title: "Structured output, not a chat reply",
    body: "One run produces a buyer memo and a client-ready report in the same pass, plus expandable creative briefs for the tests it recommends — consistent sections, every time, ready to hand off. Reproducing that from a chat reply means re-formatting it yourself, and doing that formatting work again on the next account.",
  },
  {
    icon: ShieldIcon,
    title: "A stated privacy boundary",
    body: (
      <>
        Your CSV is processed in memory for one request and never stored
        server-side, on any tier — see{" "}
        <Link
          href="/security"
          className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
        >
          the security policy
        </Link>
        . Pasting spend and performance data into a general-purpose chat
        tool means trusting its retention policy, not a boundary this
        product is built around.
      </>
    ),
  },
] as const;

const DIFFERENCES_2: { icon: typeof GaugeIcon; title: string; body: ReactNode }[] = [
  {
    icon: SparklesIcon,
    title: "Competitor evidence, not a guess",
    body: "The competitor debrief works from what you actually paste in — ad copy, hooks, formats you observed — and reads it against a fixed set of pattern rules, the same ones every time. It won't invent a competitor's spend or performance, and it says so when there isn't enough pasted evidence to conclude anything.",
  },
  {
    icon: FlaskIcon,
    title: "Session-scoped on purpose",
    body: (
      <>
        ChatGPT, Claude, and Gemini all offer persistent memory now — genuinely
        useful for a lot of workflows, and we&rsquo;re not claiming otherwise.
        Debrief works differently on purpose: no raw ads data is stored
        between visits, today. Paste in your own team&rsquo;s past test
        outcomes — what worked, what failed, what to avoid — and the
        next-test recommendations adjust around them for that session; you
        paste them in again next time, because nothing is saved yet.
        That&rsquo;s the current tradeoff for keeping your ads data out of any
        server-side store. A future opt-in workspace is planned for
        structured learnings — a learning&rsquo;s type, hook, angle, and
        outcome, and your note — which are conclusions you write, not your
        raw CSV or ad data. See{" "}
        <Link
          href="/security"
          className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
        >
          the security page
        </Link>{" "}
        for what&rsquo;s built and what&rsquo;s still roadmap.
      </>
    ),
  },
] as const;

export default function VsChatGptPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Debrief vs. ChatGPT, Claude &amp; Gemini</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>ChatGPT, Claude, and Gemini can all
          do this.</span> Here&rsquo;s what changes if you don&rsquo;t want to
          rebuild it every time.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          A skilled media buyer can paste ad data into ChatGPT, Claude, or
          Gemini, write a good prompt, and get a useful read. That&rsquo;s
          real — we&rsquo;re not claiming otherwise. What Debrief changes is
          what happens on the second account, the tenth account, and the
          client who wants to see the rules behind the recommendation.
        </p>
      </header>

      <div className="mt-8 space-y-3">
        {DIFFERENCES.map((section, i) => (
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

        {/* Competitor consumer-policy comparison — every fact here is
            from the approved, dated source list in docs/REVERIFY.md.
            Nothing added, broadened, or inferred beyond it. */}
        <section
          className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
          style={{ animationDelay: "360ms" }}
        >
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-white">
            <span className={`h-7 w-7 shrink-0 ${iconChip}`}>
              <ShieldIcon className="h-3.5 w-3.5" />
            </span>
            This isn&rsquo;t a ChatGPT problem. It&rsquo;s a chat-tool problem.
          </h2>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
            This isn&rsquo;t about one provider being worse than the others —
            it&rsquo;s about how consumer chat plans generally handle your
            data by default. The figures below are for each provider&rsquo;s
            free/consumer tier specifically; enterprise, Team, and API
            offerings are governed by separate terms not covered here.
          </p>

          <div className="mt-4 space-y-3">
            {AI_POLICY_ROWS.map((row) => (
              <div key={row.name} className={`${cardNested} p-4`}>
                <h3 className="text-[13px] font-semibold text-zinc-200">
                  {row.name}
                </h3>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-zinc-400">
                  {row.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                  Source:{" "}
                  {row.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && ", "}
                      <PolicySourceLink label={s.label} url={s.url} />
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs font-medium text-zinc-500">
            Policies verified July 14, 2026.
          </p>

          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Every provider offers controls, and enterprise tiers differ. That
            is the point: their boundary depends on settings and policy.
            Debrief&rsquo;s raw-ads-data boundary is architectural.
          </p>
        </section>

        {DIFFERENCES_2.map((section, i) => (
          <section
            key={section.title}
            className={`animate-rise ${card} ${cardLift} p-5 sm:p-6`}
            style={{ animationDelay: `${450 + i * 90}ms` }}
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

      <section
        className={`animate-rise mt-3 ${card} p-5 sm:p-6`}
        style={{ animationDelay: "720ms" }}
      >
        <h2 className="text-[15px] font-semibold tracking-tight text-white">
          What we&rsquo;re not claiming
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
          We&rsquo;re not saying ChatGPT, Claude, or Gemini can&rsquo;t
          analyze ad data — they can, and a careful prompt can get close to
          what Debrief produces on a single run. Debrief isn&rsquo;t
          AI-powered analysis at all; it&rsquo;s fixed, published rules
          applied the same way every time, with no prompt to re-write, no
          model to second-guess, and no formatting work left over once
          it&rsquo;s done.
        </p>
      </section>

      <p className="animate-rise mt-8 text-sm leading-relaxed text-zinc-400" style={{ animationDelay: "810ms" }}>
        See it on real data first:{" "}
        <Link
          href="/sample"
          className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
        >
          view a sample report
        </Link>
        , or{" "}
        <Link
          href="/generator"
          className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-4 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
        >
          run your own CSV
        </Link>
        .
      </p>

      <p className="animate-rise mt-6 text-xs text-zinc-500" style={{ animationDelay: "870ms" }}>
        Competitor policy claims last verified July 14, 2026.
      </p>
    </div>
  );
}
