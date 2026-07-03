import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken } from "@/modules/auth";
import { metaConnector } from "@/modules/connectors/meta";
import { ConnectorError } from "@/modules/connectors/types";
import {
  PeriodPreset,
  pctChange,
  resolvePeriod,
  summarize,
} from "@/modules/metrics";

/**
 * GET /api/insights?accountId=act_x&period=last_7d
 *
 * Returns account KPIs (current vs previous period), a daily spend series,
 * and a campaign table for the current period.
 *
 * Interim data path: reads live from Meta using the session token. Once the
 * persistence milestone lands, this route reads from insights_daily instead
 * and becomes instant + historical. The response shape will not change.
 */

const PERIODS: PeriodPreset[] = [
  "last_7d",
  "last_14d",
  "last_30d",
  "this_month",
];

export async function GET(request: NextRequest) {
  const access = await resolveAccessToken(request);
  const accessToken = access?.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "not_connected" },
      { status: 401 }
    );
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  const periodParam = request.nextUrl.searchParams.get("period") ?? "last_7d";

  if (!accountId) {
    return NextResponse.json(
      { ok: false, error: "Missing accountId" },
      { status: 400 }
    );
  }
  if (!PERIODS.includes(periodParam as PeriodPreset)) {
    return NextResponse.json(
      { ok: false, error: `period must be one of ${PERIODS.join(", ")}` },
      { status: 400 }
    );
  }

  const { current, previous } = resolvePeriod(periodParam as PeriodPreset);

  try {
    const [currentDaily, previousTotals, campaigns] = await Promise.all([
      metaConnector.fetchInsights(accessToken, {
        accountExternalId: accountId,
        level: "account",
        range: current,
        daily: true,
      }),
      metaConnector.fetchInsights(accessToken, {
        accountExternalId: accountId,
        level: "account",
        range: previous,
      }),
      metaConnector.fetchInsights(accessToken, {
        accountExternalId: accountId,
        level: "campaign",
        range: current,
        limit: 50,
      }),
    ]);

    const kpis = summarize(currentDaily);
    const prevKpis = summarize(previousTotals);

    return NextResponse.json(
      {
        ok: true,
        period: { preset: periodParam, current, previous },
        kpis,
        previousKpis: prevKpis,
        deltas: {
          spend: pctChange(kpis.spend, prevKpis.spend),
          conversions: pctChange(kpis.conversions, prevKpis.conversions),
          revenue: pctChange(kpis.revenue, prevKpis.revenue),
          ctr: pctChange(kpis.ctr, prevKpis.ctr),
          cpm: pctChange(kpis.cpm, prevKpis.cpm),
          cpa: pctChange(kpis.cpa, prevKpis.cpa),
          roas: pctChange(kpis.roas, prevKpis.roas),
        },
        series: currentDaily
          .filter((row) => row.date)
          .map((row) => ({
            date: row.date,
            spend: row.metrics.spend,
            conversions: row.metrics.conversions,
          })),
        campaigns: campaigns
          .map((row) => ({
            id: row.entityExternalId,
            name: row.entityName,
            ...summarize([row]),
          }))
          .sort((a, b) => b.spend - a.spend),
      },
      // Periods end yesterday, so a short private cache makes back-nav
      // instant without ever serving misleading data.
      { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=600" } }
    );
  } catch (error) {
    if (error instanceof ConnectorError) {
      const status =
        error.code === "auth_expired"
          ? 401
          : error.code === "rate_limited"
            ? 429
            : 502;
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status }
      );
    }
    return NextResponse.json(
      { ok: false, error: "internal", message: "Unexpected server error" },
      { status: 500 }
    );
  }
}
