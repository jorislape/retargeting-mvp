import { CompetitorDebriefPanel } from "@/components/competitorDebrief/CompetitorDebriefPanel";
import { gradientText } from "@/components/ui/theme";

export const metadata = {
  title: "Competitor debrief — Debrief",
  description:
    "Paste what you observed about a competitor's ads and get a structured, directional read — no CSV required.",
};

export default function CompetitorDebriefPage() {
  return (
    <div className="space-y-6">
      <div className="print-hidden">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Competitor <span className={gradientText}>debrief</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          A separate flow from the performance debrief — no CSV needed. Paste
          what you&rsquo;ve seen from a competitor&rsquo;s ads and get a
          structured, directional summary of hooks, formats, offers, and
          positioning to inspire your own tests.
        </p>
      </div>
      <CompetitorDebriefPanel />
    </div>
  );
}
