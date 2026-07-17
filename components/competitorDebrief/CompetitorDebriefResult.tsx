import { useState } from "react";
import type { CompetitorDebrief, CompetitorDebriefTest, LearningOutcome } from "@/modules/competitorDebrief";
import { btnPrimarySm, btnSecondary, card, cardNested, eyebrow } from "@/components/ui/theme";
import { AlertTriangleIcon, ArrowIcon, CheckIcon, PrinterIcon, SlidersIcon } from "@/components/ui/icons";
import { Wordmark } from "@/components/ui/brand";
import {
  COMPETITOR_CLIENT_MODE_HIDDEN,
  COMPETITOR_SECTIONS,
  COMPETITOR_SECTION_IDS,
} from "@/components/report/reportSections";
import { accentCssVars, getAccentById } from "@/components/report/reportCustomization";
import { useReportCustomization } from "@/components/report/useReportCustomization";
import { ReportCustomizationPanel } from "@/components/report/ReportCustomizationPanel";

/** Mirrors CompetitorDebriefPanel's LEARNING_OUTCOME_COPY — kept as a
 *  small local duplicate rather than a shared import since this is
 *  purely a display-styling map (4 colors), not shared logic. */
const LEARNING_OUTCOME_COPY: Record<LearningOutcome, { label: string; className: string }> = {
  worked: { label: "Worked", className: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300" },
  failed: { label: "Failed", className: "border-red-500/30 bg-red-500/[0.08] text-red-300" },
  avoid: { label: "Avoid", className: "border-amber-500/30 bg-amber-500/[0.08] text-amber-300" },
  learning: { label: "Learning", className: "border-accent/30 bg-accent/[0.08] text-accent-soft" },
  unknown: { label: "Unrecognized", className: "border-white/10 bg-white/[0.03] text-zinc-500" },
};

/** Deliberately more saturated than this app's usual quiet 3-6% fills
 *  (see components/ui/theme.ts) — a real, correct internal-learning
 *  adjustment was easy to miss at the default low-opacity treatment
 *  (reported as "the report looks almost identical" even when the
 *  data was genuinely different underneath). Still within the app's
 *  emerald/amber vocabulary — win/validated = emerald, changed/warned
 *  = amber — just louder specifically here, since this box's entire
 *  job is to be noticed while scrolling past several other cards. */
const INTERNAL_LEARNING_NOTE_STYLE: Record<
  string,
  { className: string; Icon: typeof CheckIcon }
> = {
  "builds-on": { className: "border-emerald-500/40 bg-emerald-500/[0.12] text-emerald-300", Icon: CheckIcon },
  adjusted: { className: "border-amber-500/40 bg-amber-500/[0.12] text-amber-300", Icon: AlertTriangleIcon },
  "avoids-failed": { className: "border-amber-500/40 bg-amber-500/[0.12] text-amber-300", Icon: AlertTriangleIcon },
};

/** Section-title treatment shared on screen (`eyebrow`) and in print
 *  (`.print-section-label` — small caps, print-accent ink, a thin
 *  accent rule; see app/globals.css). Combining both keeps on-screen
 *  appearance byte-identical while giving print its own hierarchy. */
const sectionLabel = `${eyebrow} print-section-label print-heading`;

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={`${cardNested} print-avoid-break min-w-0 p-4`}>
      <p className="print-kv-label mb-2 text-xs font-semibold text-white">{title}</p>
      <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="shrink-0 text-zinc-600">–</span>
            <span className="print-kv-value min-w-0 max-w-prose break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Concise, overflow-safe source reference: a short clickable label
 *  (never the raw URL as visible text) with the full address available
 *  via title/aria-label for verification on hover or with a screen
 *  reader. `referenceOnly` (default true) appends the manual modes'
 *  "(reference only — not fetched)" note — pass false for the Ads
 *  Library link when sourceMode is "adsLibraryApi", where the ads WERE
 *  fetched via Meta's Ad Library API and that note would be false. */
function SourceLink({ label, url, referenceOnly = true }: { label: string; url: string; referenceOnly?: boolean }) {
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
      {referenceOnly && <span className="shrink-0 text-[11px] text-zinc-600">(reference only — not fetched)</span>}
    </div>
  );
}

/** One "→ label: value" scan line — the building block of a TestCard
 *  group. Label and value are separate nodes (markup only, no text
 *  rewrite) so print CSS can quiet the label and bolden the value —
 *  see .print-kv-label / .print-kv-value in app/globals.css. */
function TestLine({ label, value }: { label?: string; value: string }) {
  return (
    <p className="flex min-w-0 gap-1.5 text-xs leading-relaxed text-zinc-400">
      <span className="shrink-0 text-zinc-600">→</span>
      <span className="min-w-0 max-w-prose break-words">
        {label ? (
          <>
            <span className="print-kv-label font-medium text-zinc-300">{label}: </span>
            <span className="print-kv-value">{value}</span>
          </>
        ) : (
          value
        )}
      </span>
    </p>
  );
}

interface TestLineSpec {
  label?: string;
  value: string;
}

/** A labeled group of scan lines within a test card — "Hypothesis",
 *  "Test", "Why", "Learn". Groups the 6 required fields (hypothesis,
 *  hook/angle, format, proof mechanism, offer/CTA, what you'll learn)
 *  into 4 scannable blocks without dropping any of them. */
function TestGroup({ label, lines }: { label: string; lines: TestLineSpec[] }) {
  return (
    <div className="space-y-1">
      <p className="print-section-label text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      {lines.map((line, i) => (
        <TestLine key={i} label={line.label} value={line.value} />
      ))}
    </div>
  );
}

function TestCard({ test, index }: { test: CompetitorDebriefTest; index: number }) {
  return (
    <div className={`${cardNested} print-avoid-break min-w-0 space-y-3 p-4`}>
      {/* Print-only "Test N" heading — a quick scan anchor. On screen
          the surrounding numbered section already establishes this is
          a list of tests, so this stays print-only rather than adding
          a second, redundant number on screen. */}
      <p className="print-only print-accent text-[10px] font-bold uppercase tracking-[0.08em]">
        Test {index + 1}
      </p>
      {test.internalLearningNote &&
        (() => {
          const { className, Icon } = INTERNAL_LEARNING_NOTE_STYLE[test.internalLearningNote.kind];
          return (
            <div className={`flex min-w-0 items-start gap-2 rounded-lg border p-2.5 text-[11px] leading-relaxed ${className}`}>
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{test.internalLearningNote.label}</p>
                <p className="mt-0.5 min-w-0 max-w-prose break-words opacity-90">
                  {test.internalLearningNote.explanation}
                </p>
              </div>
            </div>
          );
        })()}
      <TestGroup label="Hypothesis" lines={[{ value: test.hypothesis }]} />
      <TestGroup
        label="Test"
        lines={[
          { label: "Hook / angle", value: test.hookOrAngle },
          { label: "Format", value: test.format },
        ]}
      />
      <TestGroup
        label="Why"
        lines={[
          { label: "Proof mechanism", value: test.proofMechanism },
          { label: "Offer / CTA", value: test.offerOrCta },
        ]}
      />
      <TestGroup label="Learn" lines={[{ value: test.whatYoullLearn }]} />
    </div>
  );
}

/** Its own section, deliberately between competitor evidence and the
 *  recommended tests — requirement: clearly separate competitor
 *  evidence / internal learnings / recommended next move. Shown only
 *  when the user actually pasted something (debrief.internalLearnings
 *  is null otherwise) — never a forced empty section. */
function InternalLearningsConsidered({ debrief }: { debrief: CompetitorDebrief }) {
  if (!debrief.internalLearnings || debrief.internalLearnings.items.length === 0) return null;

  // Data-derived only — a count of a field the engine already set on
  // each test, never a new claim. Exists because a real, correct
  // adjustment was easy to miss when the only signal was a small badge
  // buried inside a test card several sections down — this puts the
  // headline number where it can't be missed.
  const affectedCount = debrief.nextTests.filter((t) => t.internalLearningNote).length;

  return (
    <div className="min-w-0 space-y-2">
      <p className={sectionLabel}>Internal learnings considered</p>
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Your team&rsquo;s own pasted context — used only to adjust which tests are
        recommended below, never to infer performance beyond what you entered.
      </p>
      {affectedCount > 0 ? (
        <p className="print-avoid-break min-w-0 rounded-lg border border-accent/30 bg-accent/[0.08] px-3 py-2 text-xs font-semibold text-accent-soft">
          {affectedCount} of {debrief.nextTests.length} recommended test{debrief.nextTests.length === 1 ? "" : "s"} below{" "}
          {affectedCount === 1 ? "was" : "were"} adjusted using these learnings — look for the highlighted note on
          each affected test card.
        </p>
      ) : (
        <p className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
          None of the recommended tests below matched these learnings closely enough to adjust — they&rsquo;re shown
          exactly as they would be without this context, per the same conservative-matching rule that keeps this
          feature from over-claiming a connection that isn&rsquo;t really there.
        </p>
      )}
      <div className={`${cardNested} print-avoid-break min-w-0 space-y-1.5 p-4`}>
        {debrief.internalLearnings.items.map((learning, i) => {
          const copy = LEARNING_OUTCOME_COPY[learning.outcome];
          return (
            <div key={i} className="flex min-w-0 items-start gap-2 text-xs">
              <span
                className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${copy.className}`}
              >
                {copy.label}
              </span>
              <span className="min-w-0 max-w-prose break-words text-zinc-300">{learning.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const hasStrategicPatterns = (debrief: CompetitorDebrief): boolean =>
  debrief.dominantNarrative.length > 0 ||
  debrief.problemFraming.length > 0 ||
  debrief.enemyOrAlternative.length > 0 ||
  debrief.desiredOutcome.length > 0 ||
  debrief.proofStrategy.length > 0 ||
  debrief.offerCtaStrategy.length > 0 ||
  debrief.creativeStructure.length > 0;

/** The print-only executive summary: five short, labeled lines built
 *  ONLY from fields the engine already produced (never a new
 *  interpretation). A line is omitted whenever its source field is
 *  empty; the whole block is omitted when nothing qualifies — matches
 *  the same honesty rule the rest of this report already follows. */
function ExecutiveSummary({ debrief }: { debrief: CompetitorDebrief }) {
  const candidates: { label: string; value: string | undefined }[] = [
    { label: "Dominant mechanism", value: debrief.dominantNarrative[0] },
    { label: "Rejected alternative", value: debrief.enemyOrAlternative[0] },
    { label: "Primary proof strategy", value: debrief.proofStrategy[0] },
    { label: "Offer / CTA", value: debrief.offerCtaStrategy[0] },
    { label: "First recommended test", value: debrief.nextTests[0]?.hookOrAngle },
  ];
  const lines: TestLineSpec[] = candidates
    .filter((l) => Boolean(l.value))
    .map((l) => ({ label: l.label, value: l.value as string }));

  if (lines.length === 0) return null;

  return (
    <div className="print-only print-exec-summary print-avoid-break border border-white/10 p-3">
      <p className="print-section-label mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em]">
        Executive summary
      </p>
      <div className="space-y-1">
        {lines.map((line) => (
          <TestLine key={line.label} label={line.label} value={line.value} />
        ))}
      </div>
    </div>
  );
}

export function CompetitorDebriefResult({
  debrief,
  generatedAt = null,
}: {
  debrief: CompetitorDebrief;
  generatedAt?: number | null;
}) {
  const customizationActions = useReportCustomization(COMPETITOR_SECTION_IDS, COMPETITOR_CLIENT_MODE_HIDDEN);
  const { customization } = customizationActions;
  const [panelOpen, setPanelOpen] = useState(false);
  const accent = getAccentById(customization.accentId);
  const displayTitle = customization.reportTitle.trim() || debrief.competitorName;
  const sections = customization.sections;

  return (
    <div style={accentCssVars(accent) as React.CSSProperties} className={`${card} min-w-0 space-y-6 p-5 sm:p-6`}>
      {/* Print-only masthead: brand + report type + subtitle. The
          competitor name and generation date follow immediately below
          in the existing header block (already print-visible), so
          this stays compact rather than duplicating a full cover
          page. */}
      <div className="print-only mb-1">
        <Wordmark className="text-sm" />
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
          Competitor Debrief
        </p>
        <p className="text-[10px] leading-relaxed text-zinc-500">
          {debrief.sourceMode === "adsLibraryApi"
            ? "Directional read of selected Meta Ads Library ads — evidence and interpretation kept separate throughout."
            : "Directional read of pasted competitor ad examples — evidence and interpretation kept separate throughout."}
        </p>
      </div>

      <div className="print-hidden flex items-center justify-end gap-2">
        {/* Toolbar hierarchy: Print / Save PDF is the one primary
            action; Customize report is secondary. */}
        <button
          type="button"
          onClick={() => window.print()}
          title="Choose “Save as PDF” in the print dialog and disable browser headers and footers for the cleanest export."
          className={`cursor-pointer ${btnPrimarySm}`}
        >
          <PrinterIcon className="h-3.5 w-3.5" />
          Print / Save PDF
        </button>
        {/* Customization only ever appears once a report already exists —
            this button lives here, inside the result itself, never in the
            input panel. */}
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className={`cursor-pointer ${btnSecondary}`}
        >
          <SlidersIcon className="h-3.5 w-3.5" />
          Customize report
        </button>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-4">
          <p className={`${eyebrow} min-w-0 break-words`}>{displayTitle}</p>
          {customization.agencyLogo && (
            // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, no next/image loader applies
            <img
              src={customization.agencyLogo.url}
              alt={customization.agencyName ? `${customization.agencyName} logo` : "Agency logo"}
              className="print-logo h-7 w-auto max-w-[120px] shrink-0 object-contain"
            />
          )}
        </div>
        {(customization.agencyName || customization.clientName) && (
          <p className="text-[11px] text-zinc-400">
            {customization.agencyName && (
              <>
                Prepared by <span className="font-medium text-zinc-300">{customization.agencyName}</span>
              </>
            )}
            {customization.agencyName && customization.clientName && " · "}
            {customization.clientName && (
              <>
                for <span className="font-medium text-zinc-300">{customization.clientName}</span>
              </>
            )}
          </p>
        )}
        <p className="print-only text-[11px] text-zinc-500">
          {customization.dateOverride
            ? new Date(`${customization.dateOverride}T00:00:00`).toLocaleDateString()
            : generatedAt
              ? `Generated ${new Date(generatedAt).toLocaleString()}`
              : ""}
        </p>
        {sections.sources && (
          <>
            {debrief.sources.adsLibraryUrl && (
              <SourceLink
                label="Meta Ads Library"
                url={debrief.sources.adsLibraryUrl}
                // In Search advertiser mode the ads WERE fetched from the
                // Ad Library API — "reference only — not fetched" is
                // manual-paste wording. The website link below keeps it in
                // both modes: the website is never fetched by this flow.
                referenceOnly={debrief.sourceMode !== "adsLibraryApi"}
              />
            )}
            {debrief.sources.websiteUrl && (
              <SourceLink label="Website" url={debrief.sources.websiteUrl} />
            )}
          </>
        )}
      </div>

      {!debrief.insufficientEvidence && sections.executiveSummary && <ExecutiveSummary debrief={debrief} />}

      <div className={`${cardNested} min-w-0 p-4`}>
        <p className="print-kv-label mb-1 text-xs font-semibold text-white">Evidence summary</p>
        <p className="print-kv-value min-w-0 max-w-prose break-words text-xs leading-relaxed text-zinc-300">
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
          {sections.observedEvidence && (
            <div className="min-w-0 space-y-2">
              <p className={sectionLabel}>Observed evidence</p>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Section title="Recurring hooks" items={debrief.recurringHooks} />
                <Section title="Creative formats" items={debrief.creativeFormats} />
                <Section title="Offer patterns" items={debrief.offerPatterns} />
                <Section title="Positioning themes" items={debrief.positioningThemes} />
              </div>
            </div>
          )}

          {sections.strategicPatterns && hasStrategicPatterns(debrief) && (
            <div className="min-w-0 space-y-2">
              <p className={sectionLabel}>Strategic patterns — directional interpretation</p>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                {debrief.sourceMode === "adsLibraryApi"
                  ? "Only patterns observed repeatedly across the selected ads — never from a single example."
                  : "Only patterns observed repeatedly across the pasted examples — never from a single example."}
              </p>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Section title="Dominant narrative / mechanism" items={debrief.dominantNarrative} />
                <Section title="Problem framing" items={debrief.problemFraming} />
                <Section title="Enemy / alternative rejected" items={debrief.enemyOrAlternative} />
                <Section title="Desired outcome" items={debrief.desiredOutcome} />
                <Section title="Proof strategy" items={debrief.proofStrategy} />
                <Section title="Offer & CTA strategy" items={debrief.offerCtaStrategy} />
                <Section title="Creative structure" items={debrief.creativeStructure} />
              </div>
            </div>
          )}

          {sections.strategicSummary && debrief.strategicSummary && (
            <div className="print-avoid-break min-w-0 rounded-lg border border-accent/25 bg-accent/[0.06] p-4">
              <p className="print-kv-label mb-1 text-xs font-semibold text-accent-soft">
                Strategic summary
              </p>
              <p className="print-kv-value min-w-0 max-w-prose break-words text-xs leading-relaxed text-zinc-200">
                {debrief.strategicSummary}
              </p>
            </div>
          )}

          {sections.whatStandsOut && debrief.whatStandsOut.length > 0 && (
            <div className="min-w-0 space-y-2">
              <p className={sectionLabel}>What stands out — directional interpretation</p>
              <div className={`${cardNested} print-avoid-break min-w-0 p-4`}>
                <ul className="space-y-2 text-xs leading-relaxed text-zinc-300">
                  {debrief.whatStandsOut.map((item) => (
                    <li key={item} className="flex gap-1.5">
                      <span className="shrink-0 text-zinc-600">–</span>
                      <span className="print-kv-value min-w-0 max-w-prose break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {sections.internalLearnings && <InternalLearningsConsidered debrief={debrief} />}

          {sections.nextTests && debrief.nextTests.length > 0 && (
            <div className="min-w-0 space-y-2">
              <p className={sectionLabel}>Next creative tests — directional interpretation</p>
              <div className="space-y-3">
                {debrief.nextTests.map((test, i) => (
                  <TestCard key={test.hypothesis} test={test} index={i} />
                ))}
              </div>
            </div>
          )}

          {sections.whatToMonitor && <Section title="What to monitor next" items={debrief.whatToMonitorNext} />}
        </>
      )}

      <div className="min-w-0 space-y-1 border-t border-white/[0.06] pt-4">
        {/* sections.footer gates only this editorial caveat line — the
            Meta non-affiliation disclaimer just below is mandatory and
            never gated by any toggle (see the scope fence). */}
        {sections.footer && (
          <p className="print-footer min-w-0 max-w-prose break-words text-[11px] leading-relaxed text-zinc-500">
            {debrief.caveat}
          </p>
        )}
        {/* Print-only: repeats the essentials in case this page is
            handed off apart from the on-screen app. */}
        <p className="print-only print-footer min-w-0 leading-relaxed text-zinc-500">
          Not affiliated with Meta Platforms, Inc. Generated by Debrief
          {generatedAt ? ` on ${new Date(generatedAt).toLocaleString()}` : ""}.
        </p>
      </div>

      <ReportCustomizationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        actions={customizationActions}
        sections={COMPETITOR_SECTIONS}
        defaultTitlePlaceholder={debrief.competitorName}
      />
    </div>
  );
}
