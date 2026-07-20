export { parseCsv, toTable, parseNumericCell } from "./csv";
export { resolveColumns, requiredColumnsFor } from "./columns";
export { applyFormatOverrides, extractAds, extractNameTags } from "./extract";
export { analyze, DEFAULT_SPEND_FLOOR } from "./analysis";
export {
  buildDecision,
  CONCENTRATION_GUARDRAIL_PCT,
  CUT_MIN_SPEND_SHARE_PCT,
  DECISION_MIN_JUDGED,
  FLAT_FIELD_DELTA_PCT,
  SCALE_TEST_MIN_DELTA_PCT,
} from "./decision";
export { fmtMoney } from "./format";
export { generateMemo } from "./memo";
export {
  assessMarketNotes,
  EMPTY_COMPETITOR_SOURCE,
  extractMarketSignals,
  formatCompetitorSources,
  MAX_COMPETITOR_SOURCES,
  mergeCompetitorSourcesIntoNotes,
  structureMarketNotes,
} from "./marketSignals";
export type { CompetitorSource, MarketSignals } from "./marketSignals";
export {
  formatSelectedSignals,
  SIGNAL_BUILDER_CAVEAT,
  SIGNAL_BUILDER_GROUPS,
  SIGNAL_PRESETS,
} from "./signalBuilder";
export {
  SAMPLE_CONTEXT,
  SAMPLE_CSV_FILENAME,
  SAMPLE_CSV_TEXT,
} from "./sampleCsv";
export * from "./types";
