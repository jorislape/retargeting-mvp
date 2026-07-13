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
  type AdCompleteness,
  type AdCompletenessStatus,
  type ParsedAdExample,
} from "./adParser";
