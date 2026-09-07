// Relative, explicit-".ts" imports on purpose (allowImportingTsExtensions
// in tsconfig.json) — the same pattern modules/debrief/decision.ts uses,
// so this whole file's dependency chain is directly importable by plain
// Node's type-stripping test runner (see scripts/reportCustomization.test.ts).
import {
  createDefaultSections,
  applyModeDefaults,
  type ModeDefaults,
  type PresetDefinition,
  type PresetId,
} from "../report/reportCustomization.ts";
import {
  PERFORMANCE_CLIENT_MODE_HIDDEN,
  PERFORMANCE_SECTION_IDS,
  type PerformanceSectionId,
} from "../report/reportSections.ts";

/**
 * Report Foundation V1 — the 4 named Performance report presets, as
 * exact, approved snapshots. Lives here (components/debrief/, not
 * components/report/) on purpose: this is Performance-specific
 * knowledge (concrete section ids, which ones are on/off per preset),
 * and the generic customization module must stay free of it — see
 * reportCustomization.ts's PresetSnapshot/derivePreset doc comments and
 * useReportCustomization.ts's optional `presets` argument. Competitor
 * Debrief has no preset table this milestone; it simply doesn't pass
 * one, and its `preset` field always reads "custom" as a result.
 *
 * Section lists reuse applyModeDefaults/createDefaultSections (the
 * existing, tested "all visible" / "hide the client-mode set" helpers)
 * rather than hand-duplicating booleans, so PERFORMANCE_CLIENT_MODE_HIDDEN
 * stays the one source of truth for "patterns"/"confidence" — only the
 * ONE additional field each preset turns off beyond that (creativeBriefs
 * for Client summary, creativeBriefs + underperformers for Executive)
 * is written explicitly.
 */

const clientSections: Record<PerformanceSectionId, boolean> = {
  ...applyModeDefaults(PERFORMANCE_SECTION_IDS, "client", PERFORMANCE_CLIENT_MODE_HIDDEN),
  creativeBriefs: false,
  // Report Default Curation V1: the approved Client default set keeps
  // Confidence visible (grounding the recommendation is exactly what a
  // client-facing reader needs) — overridden here rather than dropped
  // from PERFORMANCE_CLIENT_MODE_HIDDEN, since that list is also reused
  // by the "executive" preset below, which keeps its own prior
  // (confidence-hidden) behavior unchanged.
  confidence: true,
};

export const PERFORMANCE_PRESETS: Record<
  Exclude<PresetId, "custom">,
  PresetDefinition<PerformanceSectionId>
> = {
  buyer: {
    mode: "internal",
    topAdsShown: 5,
    density: "standard",
    colorMode: "color",
    showRankingChart: true,
    showSpendAllocationChart: true,
    showMovementChart: true,
    sections: createDefaultSections(PERFORMANCE_SECTION_IDS),
  },
  client: {
    mode: "client",
    topAdsShown: 3,
    density: "standard",
    colorMode: "color",
    showRankingChart: true,
    showSpendAllocationChart: true,
    // Report Default Curation V1: off — What Changed already covers
    // this ground for the approved Client default set, so the chart
    // is available via Customize but no longer on by default.
    showMovementChart: false,
    sections: clientSections,
  },
  executive: {
    mode: "client",
    topAdsShown: 3,
    density: "compact",
    colorMode: "color",
    showRankingChart: true,
    showSpendAllocationChart: true,
    showMovementChart: true,
    // Executive's own compact behavior is unchanged by this milestone —
    // explicitly override the Client-only confidence:true above so this
    // preset (which spreads clientSections) keeps its prior value.
    sections: { ...clientSections, underperformers: false, confidence: false },
  },
  print: {
    mode: "internal",
    topAdsShown: 5,
    density: "compact",
    colorMode: "grayscale",
    showRankingChart: true,
    showSpendAllocationChart: true,
    showMovementChart: true,
    sections: createDefaultSections(PERFORMANCE_SECTION_IDS),
  },
};

/**
 * Report Default Curation V1 ("D′") — one canonical PresetSnapshot per
 * register. Two jobs: seeds the true initial mount (Report.tsx always
 * mounts in "internal"/Buyer mode, so only the `internal` entry is
 * ever used for that), and drives useReportCustomization's
 * pristine-aware setMode — a mode switch re-derives the destination
 * register's own entry here ONLY while the register being left still
 * exactly matches ITS OWN entry (nothing manually touched yet).
 *
 * `internal`'s sections are deliberately its OWN definition, distinct
 * from the "buyer" NAMED PRESET above — that preset stays the fuller
 * "everything visible" option a user can still explicitly restore via
 * Customize -> Buyer analysis; this is what a fresh (or still-
 * pristine) Buyer register shows before any interaction. `client`
 * points directly at PERFORMANCE_PRESETS.client — Client's canonical
 * default and the "Client summary" preset are the SAME approved
 * configuration, so this is one source of truth, not two definitions
 * that could drift apart.
 */
const BUYER_CANONICAL_SECTIONS: Record<PerformanceSectionId, boolean> = {
  ...createDefaultSections(PERFORMANCE_SECTION_IDS),
  verdict: false,
  patterns: false,
};

export const PERFORMANCE_MODE_DEFAULTS: ModeDefaults<PerformanceSectionId> = {
  internal: {
    topAdsShown: 5,
    density: "standard",
    colorMode: "color",
    showRankingChart: false,
    showSpendAllocationChart: true,
    showMovementChart: false,
    sections: BUYER_CANONICAL_SECTIONS,
  },
  client: PERFORMANCE_PRESETS.client,
};

export const PRESET_LABELS: Record<Exclude<PresetId, "custom">, string> = {
  buyer: "Buyer analysis",
  client: "Client summary",
  // "Executive summary" — NOT "one-pager": the real sample report at
  // this preset's section/density settings runs to ~5 printed pages,
  // so a one-page promise would be misleading. The id ("executive")
  // and every behavioral setting are unchanged; this is a label fix
  // only. Forcing an actual single page is explicitly out of scope for
  // this milestone.
  executive: "Executive summary",
  print: "Print-friendly",
};

/** Fixed display order for the preset selector — explicit rather than
 *  relying on object key insertion order. */
export const PERFORMANCE_PRESET_OPTIONS: readonly { id: Exclude<PresetId, "custom">; label: string }[] = [
  { id: "buyer", label: PRESET_LABELS.buyer },
  { id: "client", label: PRESET_LABELS.client },
  { id: "executive", label: PRESET_LABELS.executive },
  { id: "print", label: PRESET_LABELS.print },
];
