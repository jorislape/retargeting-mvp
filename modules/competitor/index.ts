/* Public CLIENT-SAFE surface of the competitor page-fetch module —
 * pure string work only (signal extraction, notes formatting).
 *
 * The fetch itself (SSRF guard, DNS checks, the guarded GET) lives in
 * ./server.ts, which imports node builtins: API routes import that
 * file directly and client code must never touch it — same rule as
 * modules/meta/graph.ts. */
export { extractPageText } from "./pageText";
export {
  diffPageSignals,
  EMPTY_WATCHLIST_ITEM,
  formatWatchlistSignalsAsNotes,
  getWatchlistServerSnapshot,
  getWatchlistSnapshot,
  MAX_WATCHLIST_ITEMS,
  sanitizeWatchlist,
  setWatchlist,
  subscribeWatchlist,
  WATCHLIST_CAVEAT,
  type WatchlistItem,
} from "./watchlist";
export {
  appendPageSignalsToNotes,
  BENEFIT_TERMS,
  detect,
  extractPageSignals,
  formatPageSignalsAsNotes,
  POSITIONING_TERMS,
  TRUST_TERMS,
} from "./pageSignals";
export {
  formatCompetitorSignalNotes,
  groupSignalChanges,
  summarizePageSignals,
  type CompetitorSignalSummary,
  type GroupedSignalChange,
} from "./signalSummary";
export type {
  CompetitorPageSignals,
  FetchPageResponse,
  PageTextParts,
} from "./types";
