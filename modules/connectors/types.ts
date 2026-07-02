/**
 * Provider-agnostic ad platform connector interface.
 *
 * Meta is the first implementation. Google Ads is planned as the second.
 * Everything above this layer (metrics, reports, alerts, UI) must depend on
 * these types only — never on Graph API shapes directly.
 */

export type Provider = "meta";

export type EntityLevel = "account" | "campaign" | "adset" | "ad";

export type Breakdown =
  | "age"
  | "gender"
  | "publisher_platform"
  | "platform_position"
  | "device_platform";

export interface DateRange {
  /** ISO date, inclusive, in the ad account's timezone. */
  since: string;
  /** ISO date, inclusive. */
  until: string;
}

export interface AdAccount {
  provider: Provider;
  /** Provider-native id, e.g. "act_123". */
  externalId: string;
  name: string;
  currency: string;
  timezone: string;
  status: "active" | "disabled" | "unknown";
}

export interface EntitySummary {
  provider: Provider;
  level: EntityLevel;
  externalId: string;
  parentExternalId: string | null;
  name: string;
  status: string | null;
  objective: string | null;
}

/**
 * One row of performance data: a (date? , entity, breakdown?) cell.
 * All metrics normalized to numbers; monetary values in account currency.
 */
export interface InsightRow {
  date: string | null;
  level: EntityLevel;
  entityExternalId: string;
  entityName: string | null;
  breakdowns: Partial<Record<Breakdown, string>> | null;
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    /** Primary conversions (purchases or leads, whichever the account optimizes for). */
    conversions: number;
    /** Conversion value where available (purchase ROAS numerator). */
    revenue: number;
    ctr: number; // %
    cpm: number;
    cpc: number;
    frequency: number;
  };
}

export interface InsightsQuery {
  accountExternalId: string;
  level: EntityLevel;
  range: DateRange;
  /** When true, one row per entity per day; otherwise aggregated over the range. */
  daily?: boolean;
  breakdowns?: Breakdown[];
  /** Max entities to return, by spend desc. */
  limit?: number;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "auth_expired"
      | "rate_limited"
      | "permission_denied"
      | "not_found"
      | "provider_error",
    public readonly retryable: boolean,
    public readonly raw?: unknown
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

export interface AdPlatformConnector {
  provider: Provider;
  fetchAdAccounts(accessToken: string): Promise<AdAccount[]>;
  fetchEntities(
    accessToken: string,
    accountExternalId: string,
    level: Exclude<EntityLevel, "account">
  ): Promise<EntitySummary[]>;
  fetchInsights(
    accessToken: string,
    query: InsightsQuery
  ): Promise<InsightRow[]>;
}
