"use client";

import type { Memo } from "@/modules/debrief";
import type { CreativeAssetRef } from "@/components/workspace/DebriefProvider";
import { clientizeText, type ReportView } from "./memoToText";
import {
  CREATIVE_EVIDENCE_CAVEAT,
  selectSpotlights,
  SPOTLIGHT_ROLE_LABELS,
  type Spotlight,
} from "./creativeEvidence";

/**
 * Creative Evidence V1 — the "which ad are we actually talking about"
 * strip: up to three spotlight cards (Top performer / Weakest
 * performer / Biggest change) with the actual creative when one is
 * attached, a neutral placeholder when not.
 *
 * Honesty rules baked into this component:
 *  - Spotlight selection comes from creativeEvidence.ts and reads ONLY
 *    memo evidence — assets are looked up per selected ad afterward,
 *    so an image can never promote an ad into the strip.
 *  - No causal creative claims: every string here is a role label, an
 *    existing memo fact, or the fixed identification caveat.
 *  - Visibility: the strip renders only when at least one creative
 *    asset exists in the session (sample bundles them; manual attach
 *    creates them). A run with no assets renders nothing — the report
 *    stays exactly as before the feature.
 */

/** Placeholder tile — also used when an image URL fails to load. */
function PlaceholderTile() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 border border-dashed border-white/15 bg-white/[0.02] text-center"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-5 w-5 text-zinc-600"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m5 17 4.5-4.5 3 3L16 12l3 3" />
      </svg>
      <span className="px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
        Creative not attached
      </span>
    </div>
  );
}

function SpotlightCard({
  spotlight,
  asset,
  view,
}: {
  spotlight: Spotlight;
  asset: CreativeAssetRef | undefined;
  view: ReportView;
}) {
  const client = view === "client";
  const cz = (text: string) => (client ? clientizeText(text) : text);
  return (
    <div className="print-avoid-break flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {/* Creative (or placeholder) — fixed aspect so cards align and
          print at a predictable physical size. */}
      <div className="print-creative-frame relative aspect-[4/3] w-full overflow-hidden bg-white/[0.02]">
        {asset ? (
          /* Object URL or bundled public path — next/image has no
             loader for ephemeral blob: URLs (same precedent as
             LogoPicker), so a plain <img> is correct here. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={`Creative for ad "${spotlight.adName}"`}
            className="h-full w-full object-cover"
            onError={(e) => {
              /* A dead URL (e.g. revoked or missing file) degrades to
                 the placeholder instead of a broken-image glyph. */
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`absolute inset-0 ${asset ? "hidden" : ""}`}>
          <PlaceholderTile />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex flex-wrap gap-1.5">
          {spotlight.roles.map((role) => (
            <span
              key={role}
              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                role === "top"
                  ? "border-emerald-400/30 text-emerald-400 print-win"
                  : role === "worst"
                    ? "border-red-400/30 text-red-400 print-loss"
                    : "border-white/15 text-zinc-300"
              }`}
            >
              {SPOTLIGHT_ROLE_LABELS[role][client ? "client" : "buyer"]}
            </span>
          ))}
        </div>
        <p className="font-mono text-[15px] font-semibold tabular-nums leading-tight text-zinc-50">
          {spotlight.valueLabel}
          <span className="ml-2 text-xs font-medium text-zinc-400">
            {cz(spotlight.vsMedianLabel)}
          </span>
        </p>
        {spotlight.changeLabel && (
          <p className="font-mono text-[11px] tabular-nums text-zinc-400">
            {spotlight.changeLabel} vs previous period
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-zinc-400">
          {cz(client ? spotlight.takeaway.client : spotlight.takeaway.buyer)}
        </p>
        <p className="mt-auto break-words pt-1 font-mono text-[10px] leading-relaxed text-zinc-500">
          {spotlight.adName} · {spotlight.spendLabel}
          {client ? " spend" : ""}
        </p>
      </div>
    </div>
  );
}

export function CreativeEvidenceStrip({
  memo,
  view,
  assets,
}: {
  memo: Memo;
  view: ReportView;
  assets: Record<string, CreativeAssetRef>;
}) {
  /* Visibility gate: no attached assets anywhere → the feature is
     dormant and the report is unchanged. Selection below NEVER reads
     this map — it only decides whether the strip exists at all. */
  if (Object.keys(assets).length === 0) return null;

  const spotlights = selectSpotlights({
    kpiLabel: memo.scope.kpiLabel,
    adsJudged: memo.scope.adsJudged,
    winners: memo.winners,
    loserRows: memo.losers.rows,
    comparison: memo.comparison,
  });
  if (spotlights.length === 0) return null;

  const client = view === "client";
  return (
    <section
      aria-label="Creative evidence"
      className="print-avoid-break animate-rise mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Creative evidence
      </p>
      <div
        className={`mt-4 grid gap-3 ${
          spotlights.length === 1
            ? "sm:max-w-xs"
            : spotlights.length === 2
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {spotlights.map((spotlight) => (
          <SpotlightCard
            key={spotlight.assetKey}
            spotlight={spotlight}
            asset={assets[spotlight.assetKey]}
            view={view}
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        {client ? CREATIVE_EVIDENCE_CAVEAT.client : CREATIVE_EVIDENCE_CAVEAT.buyer}
      </p>
    </section>
  );
}
