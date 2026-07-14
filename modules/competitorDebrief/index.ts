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
export { looksLikeAdsLibraryCopy } from "./adsLibraryParser";
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
