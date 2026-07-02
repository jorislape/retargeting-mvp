import {
  AdAccount,
  AdPlatformConnector,
  Breakdown,
  EntityLevel,
  EntitySummary,
  InsightRow,
  InsightsQuery,
} from "../types";
import { metaGetAll } from "./client";

export function normalizeAccountId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

/** Meta action types that count as a primary conversion, in priority order. */
const CONVERSION_ACTIONS = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
];

type MetaAction = { action_type: string; value: string };

type MetaInsightRow = {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  account_id?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
} & Partial<Record<Breakdown, string>>;

function pickConversion(actions: MetaAction[] | undefined): number {
  if (!actions?.length) return 0;
  for (const type of CONVERSION_ACTIONS) {
    const match = actions.find((a) => a.action_type === type);
    if (match) return Number(match.value) || 0;
  }
  return 0;
}

function num(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function entityIdFor(level: EntityLevel, row: MetaInsightRow): {
  id: string;
  name: string | null;
} {
  switch (level) {
    case "campaign":
      return { id: row.campaign_id ?? "", name: row.campaign_name ?? null };
    case "adset":
      return { id: row.adset_id ?? "", name: row.adset_name ?? null };
    case "ad":
      return { id: row.ad_id ?? "", name: row.ad_name ?? null };
    default:
      return { id: row.account_id ?? "account", name: null };
  }
}

const LEVEL_FIELDS: Record<EntityLevel, string> = {
  account: "account_id",
  campaign: "campaign_id,campaign_name",
  adset: "adset_id,adset_name,campaign_id",
  ad: "ad_id,ad_name,adset_id,campaign_id",
};

const BASE_METRIC_FIELDS =
  "spend,impressions,clicks,reach,frequency,ctr,cpm,cpc,actions,action_values";

export const metaConnector: AdPlatformConnector = {
  provider: "meta",

  async fetchAdAccounts(accessToken: string): Promise<AdAccount[]> {
    const accounts = await metaGetAll<{
      id: string;
      name?: string;
      currency?: string;
      timezone_name?: string;
      account_status?: number;
    }>(accessToken, "me/adaccounts", {
      fields: "id,name,currency,timezone_name,account_status",
      limit: "100",
    });

    return accounts.map((a) => ({
      provider: "meta",
      externalId: a.id,
      name: a.name || a.id,
      currency: a.currency || "USD",
      timezone: a.timezone_name || "UTC",
      status:
        a.account_status === 1
          ? "active"
          : a.account_status != null
            ? "disabled"
            : "unknown",
    }));
  },

  async fetchEntities(
    accessToken: string,
    accountExternalId: string,
    level: Exclude<EntityLevel, "account">
  ): Promise<EntitySummary[]> {
    const account = normalizeAccountId(accountExternalId);
    const edge =
      level === "campaign" ? "campaigns" : level === "adset" ? "adsets" : "ads";
    const parentField =
      level === "campaign" ? null : level === "adset" ? "campaign_id" : "adset_id";

    const fields = ["id", "name", "status", "objective"]
      .concat(parentField ? [parentField] : [])
      .join(",");

    const rows = await metaGetAll<Record<string, string>>(
      accessToken,
      `${account}/${edge}`,
      { fields, limit: "200" }
    );

    return rows.map((row) => ({
      provider: "meta",
      level,
      externalId: row.id,
      parentExternalId: parentField ? (row[parentField] ?? null) : null,
      name: row.name || row.id,
      status: row.status ?? null,
      objective: row.objective ?? null,
    }));
  },

  async fetchInsights(
    accessToken: string,
    query: InsightsQuery
  ): Promise<InsightRow[]> {
    const account = normalizeAccountId(query.accountExternalId);

    const params: Record<string, string> = {
      level: query.level,
      fields: `${LEVEL_FIELDS[query.level]},${BASE_METRIC_FIELDS}`,
      time_range: JSON.stringify({
        since: query.range.since,
        until: query.range.until,
      }),
      limit: String(query.limit ?? 200),
    };
    if (query.daily) params.time_increment = "1";
    if (query.breakdowns?.length) {
      params.breakdowns = query.breakdowns.join(",");
    }

    const rows = await metaGetAll<MetaInsightRow>(
      accessToken,
      `${account}/insights`,
      params
    );

    return rows.map((row) => {
      const entity = entityIdFor(query.level, row);
      const breakdowns = query.breakdowns?.length
        ? Object.fromEntries(
            query.breakdowns
              .map((b) => [b, row[b]])
              .filter(([, v]) => v != null)
          )
        : null;

      return {
        date: query.daily ? (row.date_start ?? null) : null,
        level: query.level,
        entityExternalId: entity.id,
        entityName: entity.name,
        breakdowns,
        metrics: {
          spend: num(row.spend),
          impressions: num(row.impressions),
          clicks: num(row.clicks),
          reach: num(row.reach),
          conversions: pickConversion(row.actions),
          revenue: pickConversion(row.action_values),
          ctr: num(row.ctr),
          cpm: num(row.cpm),
          cpc: num(row.cpc),
          frequency: num(row.frequency),
        },
      };
    });
  },
};
