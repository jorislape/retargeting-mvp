import type { CompetitorDebrief, CompetitorDebriefTest } from "@/modules/competitorDebrief";
import { card, cardNested, eyebrow } from "@/components/ui/theme";
import { AlertTriangleIcon, ArrowIcon } from "@/components/ui/icons";

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={`${cardNested} min-w-0 p-4`}>
      <p className="mb-2 text-xs font-semibold text-white">{title}</p>
      <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="shrink-0 text-zinc-600">–</span>
            <span className="min-w-0 max-w-prose break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Concise, overflow-safe source reference: a short clickable label
 *  (never the raw URL as visible text) with the full address available
 *  via title/aria-label for verification on hover or with a screen
 *  reader. Source URLs are references only — never fetched by this
 *  app — so there is nothing to preview beyond the link itself. */
function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        aria-label={`${label} — open source (${url})`}
        className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-medium text-accent-soft underline decoration-accent-soft/30 underline-offset-2 hover:decoration-accent-soft"
      >
        <span className="truncate">{label} — Open source</span>
        <ArrowIcon className="h-3 w-3 shrink-0 -rotate-45" />
      </a>
      <span className="shrink-0 text-[11px] text-zinc-600">(reference only — not fetched)</span>
    </div>
  );
}

/** One "→ value" scan line — the building block of a TestCard group. */
function TestLine({ value }: { value: string }) {
  return (
    <p className="flex min-w-0 gap-1.5 text-xs leading-relaxed text-zinc-400">
      <span className="shrink-0 text-zinc-600">→</span>
      <span className="min-w-0 max-w-prose break-words">{value}</span>
    </p>
  );
}

/** A labeled group of scan lines within a test card — "Hypothesis",
 *  "Test", "Why", "Learn". Groups the 6 required fields (hypothesis,
 *  hook/angle, format, proof mechanism, offer/CTA, what you'll learn)
 *  into 4 scannable blocks without dropping any of them. */
function TestGroup({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      {lines.map((line) => (
        <TestLine key={line} value={line} />
      ))}
    </div>
  );
}

function TestCard({ test }: { test: CompetitorDebriefTest }) {
  return (
    <div className={`${cardNested} min-w-0 space-y-3 p-4`}>
      <TestGroup label="Hypothesis" lines={[test.hypothesis]} />
      <TestGroup label="Test" lines={[`Hook / angle: ${test.hookOrAngle}`, `Format: ${test.format}`]} />
      <TestGroup label="Why" lines={[`Proof mechanism: ${test.proofMechanism}`, `Offer / CTA: ${test.offerOrCta}`]} />
      <TestGroup label="Learn" lines={[test.whatYoullLearn]} />
    </div>
  );
}

export function CompetitorDebriefResult({ debrief }: { debrief: CompetitorDebrief }) {
  return (
    <div className={`${card} min-w-0 space-y-6 p-5 sm:p-6`}>
      <div className="min-w-0 space-y-1.5">
        <p className={`${eyebrow} min-w-0 break-words`}>{debrief.competitorName}</p>
        <SourceLink label="Meta Ads Library" url={debrief.sources.adsLibraryUrl} />
        {debrief.sources.websiteUrl && (
          <SourceLink label="Website" url={debrief.sources.websiteUrl} />
        )}
      </div>

      <div className={`${cardNested} min-w-0 p-4`}>
        <p className="mb-1 text-xs font-semibold text-white">Evidence summary</p>
        <p className="min-w-0 max-w-prose break-words text-xs leading-relaxed text-zinc-300">
          {debrief.evidenceSummary}
        </p>
      </div>

      {debrief.insufficientEvidence ? (
        <div className="flex min-w-0 items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 max-w-prose break-words">{debrief.insufficientEvidenceNote}</p>
        </div>
      ) : (
        <>
          <div className="min-w-0 space-y-2">
            <p className={eyebrow}>Observed evidence</p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Section title="Recurring hooks" items={debrief.recurringHooks} />
              <Section title="Creative formats" items={debrief.creativeFormats} />
              <Section title="Offer patterns" items={debrief.offerPatterns} />
              <Section title="Positioning themes" items={debrief.positioningThemes} />
            </div>
          </div>

          {debrief.whatStandsOut.length > 0 && (
            <div className="min-w-0 space-y-2">
              <p className={eyebrow}>What stands out — directional interpretation</p>
              <div className={`${cardNested} min-w-0 p-4`}>
                <ul className="space-y-2 text-xs leading-relaxed text-zinc-300">
                  {debrief.whatStandsOut.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <span className="shrink-0 text-zinc-600">–</span>
                      <span className="min-w-0 max-w-prose break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {debrief.nextTests.length > 0 && (
            <div className="min-w-0 space-y-2">
              <p className={eyebrow}>Next creative tests — directional interpretation</p>
              <div className="space-y-3">
                {debrief.nextTests.map((test) => (
                  <TestCard key={test.hypothesis} test={test} />
                ))}
              </div>
            </div>
          )}

          <Section title="What to monitor next" items={debrief.whatToMonitorNext} />
        </>
      )}

      <p className="min-w-0 max-w-prose break-words border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-zinc-500">
        {debrief.caveat}
      </p>
    </div>
  );
}
