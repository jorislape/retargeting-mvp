import type { CompetitorDebrief } from "@/modules/competitorDebrief";
import { card, cardNested, eyebrow } from "@/components/ui/theme";
import { AlertTriangleIcon } from "@/components/ui/icons";

function Section({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className={`${cardNested} p-4`}>
      <p className="mb-2 text-xs font-semibold text-white">{title}</p>
      <ul className="space-y-1 text-xs leading-relaxed text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="text-zinc-600">–</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompetitorDebriefResult({ debrief }: { debrief: CompetitorDebrief }) {
  return (
    <div className={`${card} space-y-5 p-5 sm:p-6`}>
      <div>
        <p className={eyebrow}>{debrief.competitorName}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          Ads Library: <span className="text-zinc-300">{debrief.sources.adsLibraryUrl}</span>{" "}
          <span className="text-zinc-600">(reference only — not fetched)</span>
        </p>
        {debrief.sources.websiteUrl && (
          <p className="text-xs leading-relaxed text-zinc-400">
            Website: <span className="text-zinc-300">{debrief.sources.websiteUrl}</span>{" "}
            <span className="text-zinc-600">(reference only — not fetched)</span>
          </p>
        )}
      </div>

      <div className={`${cardNested} p-4`}>
        <p className="mb-1 text-xs font-semibold text-white">Evidence summary</p>
        <p className="text-xs leading-relaxed text-zinc-300">{debrief.evidenceSummary}</p>
      </div>

      {debrief.insufficientEvidence ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{debrief.insufficientEvidenceNote}</p>
        </div>
      ) : (
        <>
          <div>
            <p className={`${eyebrow} mb-2`}>Interpretation — directional only</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Section title="Recurring hooks" items={debrief.recurringHooks} />
              <Section title="Creative formats" items={debrief.creativeFormats} />
              <Section title="Offer patterns" items={debrief.offerPatterns} />
              <Section title="Positioning themes" items={debrief.positioningThemes} />
            </div>
            <div className="mt-3">
              <Section title="What stands out" items={debrief.whatStandsOut} />
            </div>
          </div>

          {debrief.nextTests.length > 0 && (
            <div>
              <p className={`${eyebrow} mb-2`}>Next creative tests</p>
              <div className="space-y-2">
                {debrief.nextTests.map((test) => (
                  <div key={test.title} className={`${cardNested} p-3`}>
                    <p className="text-xs font-semibold text-white">{test.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">{test.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Section title="What to monitor next" items={debrief.whatToMonitorNext} />
        </>
      )}

      <p className="border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-zinc-500">
        {debrief.caveat}
      </p>
    </div>
  );
}
