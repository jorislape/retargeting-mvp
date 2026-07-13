"use client";

import { useMemo, useState } from "react";
import type {
  AdCompleteness,
  CompetitorDebrief,
  CompetitorDebriefApiError,
  ParsedAdExample,
} from "@/modules/competitorDebrief";
import {
  computeAdCompleteness,
  dedupeAdTexts,
  findDuplicateIndices,
  parseAdExample,
  parseBulkAdExamples,
  splitAdBlocks,
} from "@/modules/competitorDebrief";
import { btnPrimary, btnSecondary, card, cardNested, fieldLabel, inputBase } from "@/components/ui/theme";
import { AlertTriangleIcon, CopyIcon, SparklesIcon } from "@/components/ui/icons";
import { CompetitorDebriefResult } from "./CompetitorDebriefResult";

/** Fill-in-the-blank shape the parser reads most reliably (explicit
 *  labels win over keyword-fallback detection) — offered as a one-click
 *  copy so users aren't guessing at a format from the placeholder text
 *  alone. Two slots, not one, since the value here is showing the
 *  between-ads separator too. */
const PASTE_TEMPLATE = `Ad 1
Headline:
Hook:
CTA:
Offer:
Format:

Ad 2
Headline:
Hook:
CTA:
Offer:
Format: `;

const COMPLETENESS_COPY: Record<AdCompleteness["status"], { label: string; tone: "ok" | "warn" | "bad" }> = {
  complete: { label: "Looks complete", tone: "ok" },
  partial: { label: "Missing", tone: "warn" },
  empty: { label: "No fields or signals detected", tone: "warn" },
  malformed: { label: "Too short to be usable ad content", tone: "bad" },
};

/**
 * Competitor Debrief V1 — a separate, CSV-free flow. Primary path is
 * "Paste ads": bulk-paste multiple ad examples, review/edit the
 * deterministically split-and-extracted evidence, then generate. The
 * original single free-text field is preserved as a secondary,
 * collapsed "Advanced manual notes" fallback — never removed, just no
 * longer the first thing the user sees.
 *
 * Screenshot upload is intentionally NOT implemented here: this
 * codebase has no image/OCR pipeline (checked — no such dependency or
 * code exists), and adding one (e.g. a free/open-source library like
 * Tesseract.js) is a real new-dependency decision that needs its own
 * explicit approval rather than a stub or fake extraction.
 */

interface AdBlock {
  id: number;
  parsed: ParsedAdExample;
}

let nextBlockId = 1;
const makeBlock = (raw: string): AdBlock => ({ id: nextBlockId++, parsed: parseAdExample(raw) });

function AdBlockCard({
  block,
  index,
  duplicateOfIndex,
  onChange,
  onRemove,
}: {
  block: AdBlock;
  index: number;
  /** Index of the earlier block this one duplicates, or null if it's
   *  unique so far — see findDuplicateIndices. Warn only: never blocks
   *  editing or generation. */
  duplicateOfIndex: number | null;
  onChange: (raw: string) => void;
  onRemove: () => void;
}) {
  const { parsed } = block;
  const chips: string[] = [
    ...(parsed.headline ? [`Headline: ${parsed.headline}`] : []),
    ...(parsed.cta ? [`CTA: ${parsed.cta}`] : []),
    ...(parsed.offer ? [`Offer: ${parsed.offer}`] : []),
    ...(parsed.format ? [`Format: ${parsed.format}`] : []),
    ...(parsed.startDate ? [`Date: ${parsed.startDate}`] : []),
    ...(parsed.landingPage ? [`Landing page: ${parsed.landingPage}`] : []),
    ...parsed.detectedHooks.map((h) => `Hook: ${h}`),
    ...parsed.detectedFormats.map((f) => `Format signal: ${f}`),
    ...parsed.detectedOffers.map((o) => `Offer signal: ${o}`),
    ...parsed.detectedPositioning.map((p) => `Positioning: ${p}`),
    ...parsed.detectedTrust.map((t) => `Trust: ${t}`),
  ];

  const completeness = useMemo(() => computeAdCompleteness(parsed), [parsed]);
  const completenessCopy = COMPLETENESS_COPY[completeness.status];
  const toneClass =
    completenessCopy.tone === "ok"
      ? "text-emerald-400"
      : completenessCopy.tone === "bad"
        ? "text-red-300"
        : "text-amber-300";

  return (
    <div className={`${cardNested} min-w-0 p-3`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white">Ad {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer text-[11px] font-medium text-zinc-500 hover:text-red-300"
        >
          Remove
        </button>
      </div>
      <textarea
        rows={3}
        className={`${inputBase} resize-y text-xs`}
        value={parsed.raw}
        onChange={(e) => onChange(e.target.value)}
      />
      {parsed.raw.trim() !== "" && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className={toneClass}>
            {completenessCopy.label}
            {completeness.status === "partial" && `: ${completeness.missingFields.join(", ")}`}
          </span>
          {duplicateOfIndex !== null && (
            <span className="flex items-center gap-1 text-amber-300">
              <AlertTriangleIcon className="h-3 w-3 shrink-0" />
              Duplicate of Ad {duplicateOfIndex + 1} — won&rsquo;t be double-counted
            </span>
          )}
        </div>
      )}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="min-w-0 max-w-full truncate rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
              title={c}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface CoreFields {
  competitorName: string;
  adsLibraryUrl: string;
  websiteUrl: string;
}

const EMPTY_CORE: CoreFields = { competitorName: "", adsLibraryUrl: "", websiteUrl: "" };

export function CompetitorDebriefPanel() {
  const [core, setCore] = useState<CoreFields>(EMPTY_CORE);
  const [bulkPasteText, setBulkPasteText] = useState("");
  const [blocks, setBlocks] = useState<AdBlock[] | null>(null);
  const [advancedNotes, setAdvancedNotes] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [debrief, setDebrief] = useState<CompetitorDebrief | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [error, setError] = useState<CompetitorDebriefApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);

  async function handleCopyTemplate() {
    try {
      await navigator.clipboard.writeText(PASTE_TEMPLATE);
      setTemplateCopied(true);
      setTimeout(() => setTemplateCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — the template is
      // still visible inline, so there's nothing further to do here.
    }
  }

  const setCoreField = (key: keyof CoreFields) => (value: string) =>
    setCore((f) => ({ ...f, [key]: value }));

  function handleParseAds() {
    const parsed = parseBulkAdExamples(bulkPasteText);
    setBlocks(parsed.map((p) => ({ id: nextBlockId++, parsed: p })));
  }

  function updateBlock(id: number, raw: string) {
    setBlocks((prev) =>
      (prev ?? []).map((b) => (b.id === id ? { id, parsed: parseAdExample(raw) } : b))
    );
  }

  function removeBlock(id: number) {
    setBlocks((prev) => (prev ?? []).filter((b) => b.id !== id));
  }

  function addBlock() {
    setBlocks((prev) => [...(prev ?? []), makeBlock("")]);
  }

  const hasParsedAds = (blocks ?? []).some((b) => b.parsed.raw.trim() !== "");
  const canGenerate =
    core.competitorName.trim() !== "" &&
    core.adsLibraryUrl.trim() !== "" &&
    (hasParsedAds || advancedNotes.trim() !== "");

  // Duplicate flags are recomputed from the current blocks on every
  // render (cheap string comparisons) so editing a block's text always
  // re-evaluates duplicate status live, not just at parse time.
  const duplicateIndices = useMemo(
    () => findDuplicateIndices((blocks ?? []).map((b) => b.parsed.raw)),
    [blocks]
  );

  // Live "about to submit" count while typing, before "Parse ads" is
  // clicked — the manual click still drives the actual review step
  // below; this is only a preview.
  const liveAdCount = useMemo(
    () => (bulkPasteText.trim() === "" ? 0 : splitAdBlocks(bulkPasteText).length),
    [bulkPasteText]
  );

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const activeBlocks = (blocks ?? []).filter((b) => b.parsed.raw.trim() !== "");
      // Deduped once, here, so a pasted duplicate can never be counted
      // as a second, independent recurrence downstream (see
      // dedupeAdTexts — first occurrence wins, order preserved).
      const distinctAdTexts = dedupeAdTexts(activeBlocks.map((b) => b.parsed.raw));
      const observations = [distinctAdTexts.join("\n\n"), advancedNotes.trim()]
        .filter((part) => part !== "")
        .join("\n\n");

      const res = await fetch("/api/competitor-debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...core,
          observations,
          exampleCount: distinctAdTexts.length > 0 ? distinctAdTexts.length : undefined,
          // The individual ad texts let the engine check for patterns
          // that RECUR across distinct ads rather than treating one
          // example as a pattern — see modules/competitorDebrief/
          // strategicPatterns.ts. Deduped, so a duplicate paste can't
          // inflate a recurrence count.
          adTexts: distinctAdTexts.length > 0 ? distinctAdTexts : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(
          body?.error ?? {
            title: "Something went wrong",
            message: "The debrief couldn't be generated.",
            fix: "Try again in a moment.",
          }
        );
        setDebrief(null);
        return;
      }
      setDebrief(body.debrief);
      setGeneratedAt(Date.now());
    } catch {
      setError({
        title: "Connection issue",
        message: "The request couldn't be completed.",
        fix: "Check your connection and try again.",
      });
      setDebrief(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* The input form has no place in an exported PDF — only the
          generated result (below) should print. */}
      <div className={`print-hidden ${card} p-5 sm:p-6`}>
        <div className="mb-1 flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-accent-soft" />
          <h2 className="text-sm font-semibold text-white">Competitor debrief</h2>
        </div>
        <p className="mb-5 text-xs leading-relaxed text-zinc-400">
          Paste a competitor&rsquo;s ads (e.g. from the Meta Ads Library) and get
          a structured, directional read: recurring hooks, formats, offers, and
          positioning. This never infers spend, conversions, or performance,
          and it never fetches the Ads Library — it only interprets what you
          paste.
        </p>

        <div className="space-y-4">
          <div>
            <label className={`${fieldLabel} mb-1.5 block`} htmlFor="competitor-name">
              Competitor name
            </label>
            <input
              id="competitor-name"
              type="text"
              autoComplete="off"
              className={inputBase}
              placeholder="e.g. Competitor or brand name"
              value={core.competitorName}
              onChange={(e) => setCoreField("competitorName")(e.target.value)}
            />
          </div>

          <div>
            <label className={`${fieldLabel} mb-1.5 block`} htmlFor="ads-library-url">
              Meta Ads Library URL
            </label>
            <input
              id="ads-library-url"
              type="text"
              autoComplete="off"
              className={inputBase}
              placeholder="https://www.facebook.com/ads/library/?..."
              value={core.adsLibraryUrl}
              onChange={(e) => setCoreField("adsLibraryUrl")(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Ads Library URLs are saved as references and are not fetched
              automatically.
            </p>
          </div>

          <div>
            <label className={`${fieldLabel} mb-1.5 block`} htmlFor="website-url">
              Website / landing page URL <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              id="website-url"
              type="text"
              autoComplete="off"
              className={inputBase}
              placeholder="https://example.com"
              value={core.websiteUrl}
              onChange={(e) => setCoreField("websiteUrl")(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className={fieldLabel} htmlFor="bulk-paste">
                Paste ads
              </label>
              <button
                type="button"
                className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] font-medium text-accent-soft hover:underline"
                onClick={handleCopyTemplate}
              >
                <CopyIcon className="h-3 w-3" />
                {templateCopied ? "Copied!" : "Copy label template"}
              </button>
            </div>
            <textarea
              id="bulk-paste"
              rows={7}
              className={`${inputBase} resize-y`}
              placeholder={
                "Paste multiple ads at once — separate them with a blank line, \"---\", or labels like \"Ad 1\" / \"Ad 2\".\n\ne.g.\nAd 1\nHook: [attention-grabbing opening line]\nHeadline: [short benefit statement]\nOffer: 15% off first order\nCTA: Shop Now\n\nAd 2\n..."
              }
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-[11px] text-zinc-500">
                {liveAdCount > 0
                  ? `≈${liveAdCount} ad${liveAdCount === 1 ? "" : "s"} detected — click Parse ads to review`
                  : "Screenshot upload isn’t available yet — paste the text instead for now."}
              </p>
              <button
                type="button"
                className={`${btnSecondary} shrink-0`}
                disabled={bulkPasteText.trim() === ""}
                onClick={handleParseAds}
              >
                Parse ads
              </button>
            </div>
          </div>

          {blocks && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`${fieldLabel} min-w-0`}>
                  {blocks.length} ad{blocks.length === 1 ? "" : "s"} parsed —
                  review and edit before generating
                </p>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer text-[11px] font-medium text-accent-soft hover:underline"
                  onClick={addBlock}
                >
                  + Add another
                </button>
              </div>
              <div className="space-y-2">
                {blocks.map((b, i) => (
                  <AdBlockCard
                    key={b.id}
                    block={b}
                    index={i}
                    duplicateOfIndex={duplicateIndices[i]}
                    onChange={(raw) => updateBlock(b.id, raw)}
                    onRemove={() => removeBlock(b.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-white"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? "Hide" : "Show"} advanced manual notes
            </button>
            {advancedOpen && (
              <div className="mt-2">
                <label className={`${fieldLabel} mb-1.5 block`} htmlFor="advanced-notes">
                  Advanced manual notes <span className="text-zinc-600">(optional fallback — free text, not split into individual ads)</span>
                </label>
                <textarea
                  id="advanced-notes"
                  rows={4}
                  className={`${inputBase} resize-y`}
                  placeholder="General observations that don't fit a single ad — market notes, overall impressions, etc."
                  value={advancedNotes}
                  onChange={(e) => setAdvancedNotes(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            className={btnPrimary}
            disabled={loading || !canGenerate}
            onClick={handleGenerate}
          >
            {loading ? "Generating…" : "Generate competitor debrief"}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3 text-xs text-red-300">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{error.title}</p>
              <p className="mt-0.5 text-red-300/80">{error.message}</p>
              <p className="mt-0.5 text-red-300/60">{error.fix}</p>
            </div>
          </div>
        )}
      </div>

      {debrief && <CompetitorDebriefResult debrief={debrief} generatedAt={generatedAt} />}
    </div>
  );
}
