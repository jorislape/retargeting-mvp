/* Public CLIENT-SAFE surface of the competitor page-fetch module —
 * pure string work only (signal extraction, notes formatting).
 *
 * The fetch itself (SSRF guard, DNS checks, the guarded GET) lives in
 * ./server.ts, which imports node builtins: API routes import that
 * file directly and client code must never touch it — same rule as
 * modules/meta/graph.ts. */
export { extractPageText } from "./pageText";
export {
  appendPageSignalsToNotes,
  extractPageSignals,
  formatPageSignalsAsNotes,
} from "./pageSignals";
export type {
  CompetitorPageSignals,
  FetchPageResponse,
  PageTextParts,
} from "./types";
