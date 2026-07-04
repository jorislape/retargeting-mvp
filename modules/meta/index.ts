/* Public surface of the Meta data-source module.
 *
 * graph.ts is server-only (it talks to the Graph API and, in the
 * OAuth exchange, handles the app secret) — import it from API routes
 * only, never from client components. Client code may import the
 * types and constants re-exported here.
 */
export {
  bearerToken,
  exchangeCodeForToken,
  fetchAdAccounts,
  fetchAdInsights,
  FACEBOOK_OAUTH_DIALOG,
  GRAPH_API_VERSION,
  GraphApiError,
  MAX_INSIGHTS_ROWS,
  META_OAUTH_SCOPE,
  STATE_COOKIE,
} from "./graph";
export { escapeCsvField, insightsToCsv } from "./insightsToCsv";
export {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  type AdInsightRow,
  type DatePreset,
  type MetaAdAccount,
  type MetaOAuthMessage,
} from "./types";
