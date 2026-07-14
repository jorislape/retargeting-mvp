export { COMPETITOR_DEBRIEF_CAVEAT, generateCompetitorDebrief } from "./engine";
export type {
  CompetitorDebrief,
  CompetitorDebriefApiError,
  CompetitorDebriefInput,
  CompetitorDebriefResponse,
  CompetitorDebriefTest,
} from "./types";
export {
  computeAdCompleteness,
  countUsableAds,
  dedupeAdTexts,
  findDuplicateIndices,
  normalizeForDedupe,
  parseAdExample,
  parseBulkAdExamples,
  splitAdBlocks,
  textForAnalysis,
  type AdCompleteness,
  type AdCompletenessStatus,
  type AdParseMode,
  type ParsedAdExample,
} from "./adParser";
export { isBareCtaLine, looksLikeAdsLibraryCopy } from "./adsLibraryParser";
export {
  groupPossibleVariants,
  MAX_REPRESENTATIVES,
  processPageDump,
  selectRepresentatives,
  stripChromeLines,
  type BoundaryConfidence,
  type PageDumpCandidate,
  type PageDumpResult,
  type PageDumpWarning,
  type VariantGroup,
} from "./pageDump";
export {
  applyInternalLearnings,
  parseInternalLearnings,
  parseLearningLine,
  termsOverlap,
  type InternalLearningNote,
  type InternalLearningsSummary,
  type LearningOutcome,
  type ParsedLearning,
} from "./internalLearnings";
