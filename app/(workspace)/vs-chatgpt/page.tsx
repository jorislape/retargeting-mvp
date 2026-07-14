import Link from "next/link";
import { FileTextIcon, FlaskIcon, GaugeIcon, ShieldIcon, SparklesIcon } from "@/components/ui/icons";
import {
  card,
  cardLift,
  eyebrow,
  gradientText,
  iconChip,
} from "@/components/ui/theme";

export const metadata = {
  title: "Debrief vs. pasting into ChatGPT",
  description:
    "ChatGPT can analyze ad data if you prompt it well. Here's what Debrief does differently: a repeatable workflow, published rules, structured output, a stated privacy boundary, and no re-explaining your account every time.",
  alternates: { canonical: "/vs-chatgpt" },
};

const DIFFERENCES = [
  {
    icon: GaugeIcon,
    title: "Published, fixed rules — not a prompt",
    body: "Spend gates, medians, and confidence thresholds are code, listed on /how-it-works. A prompt that produces a good analysis today can produce a different one next time you run it, or when the model changes. Debrief's rules don't drift, and you can check the math yourself instead of trusting a paraphrase.",
  },
  {
    icon: FileTextIcon,
    title: "Structured output, not a chat reply",
    body: "One run produces a buyer memo and a client-ready report in the same pass, plus expandable creative briefs for the tests it recommends — consistent sections, every time, ready to hand off. Reproducing that from a chat reply means re-formatting it yourself, and doing that formatting work again on the next account.",
  },
  {
    icon: ShieldIcon,
    title: "A stated privacy boundary",
    body: "Your CSV is processed in memory for one request and never stored server-side, on any tier — see /security. Pasting spend and performance data into a general-purpose chat tool means trusting its retention policy, not a boundary this product is built around.",
  },
  {
    icon: SparklesIcon,
    title: "Competitor evidence, not a guess",
    body: "The competitor debrief works from what you actually paste in — ad copy, hooks, formats you observed — and reads it against a fixed set of pattern rules, the same ones every time. It won't invent a competitor's spend or performance, and it says so when there isn't enough pasted evidence to conclude anything.",
  },
  {
    icon: FlaskIcon,
    title: "Remembers what you already tried, this session",
    body: "Paste in your own team's past test outcomes — what worked, what failed, what to avoid — and the next-test recommendations adjust around them instead of re-suggesting something you already know doesn't work. Nothing here is saved between visits yet; you paste it in each time you want it applied.",
  },
] as const;

export default function VsChatGptPage() {
  return (
    <div>
      <header className="animate-rise">
        <p className={eyebrow}>Debrief vs. ChatGPT</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          <span className={gradientText}>ChatGPT can do this.</span> Here&rsquo;s
          what changes if you don&rsquo;t want to rebuild it every time.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
          A skilled media buyer can paste ad data into ChatGPT, write a good
          prompt, and get a useful read. That&rsquo;s real — we&rsquo;re not claiming
          otherwise. What Debrief changes is what happens on the second
          account, the tenth account, and the client who wants to see the
          rules behind the recommendation.
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
      </div>

      <section
        className={`animate-rise mt-3 ${card} p-5 sm:p-6`}
        style={{ animationDelay: "540ms" }}
      >
        <h2 className="text-[15px] font-semibold tracking-tight text-white">
          What we&rsquo;re not claiming
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
          We&rsquo;re not saying ChatGPT can&rsquo;t analyze ad data — it can, and a
          careful prompt can get close to what Debrief produces on a single
          run. Debrief isn&rsquo;t AI-powered analysis at all; it&rsquo;s fixed,
          published rules applied the same way every time, with no prompt to
          re-write, no model to second-guess, and no formatting work left
          over once it&rsquo;s done.
        </p>
      </section>

      <p className="animate-rise mt-8 text-sm leading-relaxed text-zinc-400" style={{ animationDelay: "630ms" }}>
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
    </div>
  );
}
