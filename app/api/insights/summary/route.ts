import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken } from "@/modules/auth";
import { metaConnector } from "@/modules/connectors/meta";
import { ConnectorError } from "@/modules/connectors/types";
import { PeriodPreset } from "@/modules/metrics";
import { getPortfolioSummary } from "@/modules/portfolio";

/**
 * GET /api/insights/summary?period=last_7d
 *
 * Portfolio overview: per-account KPIs + spend series for the period, and
 * per-currency totals. Same interim data path as /api/insights — live from
 * Meta now, insights_daily after the persistence milestone, same shape.
 *
 * Periods end yesterday, so responses are stable for hours — cacheable
 * long enough to make navigation instant without ever being misleading.
 */

const PERIODS: PeriodPreset[] = [
  "last_7d",
  "last_14d",
  "last_30d",
  "this_month",
];

const CACHE_CONTROL = "private, max-age=120, stale-while-revalidate=600";

export async function GET(request: NextRequest) {
  const access = await resolveAccessToken(request);
  const accessToken = access?.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "not_connected" },
      { status: 401 }
    );
  }

  const periodParam = request.nextUrl.searchParams.get("period") ?? "last_7d";
  if (!PERIODS.includes(periodParam as PeriodPreset)) {
    return NextResponse.json(
      { ok: false, error: `period must be one of ${PERIODS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const summary = await getPortfolioSummary(
      metaConnector,
      accessToken,
      periodParam as PeriodPreset
    );
    return NextResponse.json(
      { ok: true, ...summary },
      { headers: { "Cache-Control": CACHE_CONTROL } }
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
