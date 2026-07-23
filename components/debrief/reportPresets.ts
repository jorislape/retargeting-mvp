// Relative, explicit-".ts" imports on purpose (allowImportingTsExtensions
// in tsconfig.json) — the same pattern modules/debrief/decision.ts uses,
// so this whole file's dependency chain is directly importable by plain
// Node's type-stripping test runner (see scripts/reportCustomization.test.ts).
import {
  createDefaultSections,
  applyModeDefaults,
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
    sections: createDefaultSections(PERFORMANCE_SECTION_IDS),
  },
  client: {
    mode: "client",
    topAdsShown: 3,
    density: "standard",
    colorMode: "color",
    sections: clientSections,
  },
  executive: {
    mode: "client",
    topAdsShown: 3,
    density: "compact",
    colorMode: "color",
    sections: { ...clientSections, underperformers: false },
  },
  print: {
    mode: "internal",
    topAdsShown: 5,
    density: "compact",
    colorMode: "grayscale",
    sections: createDefaultSections(PERFORMANCE_SECTION_IDS),
  },
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
