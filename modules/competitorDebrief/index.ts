export { ADS_LIBRARY_API_CAVEAT, COMPETITOR_DEBRIEF_CAVEAT, generateCompetitorDebrief } from "./engine";
export type {
  CompetitorDebrief,
  CompetitorDebriefApiError,
  CompetitorDebriefInput,
  CompetitorDebriefResponse,
  CompetitorDebriefSourceMode,
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
  classifyAdvertiserAttribution,
  groupPossibleVariants,
  isDestinationPreviewFragment,
  MAX_REPRESENTATIVES,
  parseAliases,
  processPageDump,
  selectRepresentatives,
  stripChromeLines,
  stripLeadingHeader,
  type AdvertiserAttribution,
  type BoundaryConfidence,
  type LeadingHeaderStripResult,
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
