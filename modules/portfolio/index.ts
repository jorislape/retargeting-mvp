import {
  AdAccount,
  AdPlatformConnector,
  ConnectorError,
  DateRange,
} from "../connectors/types";
import {
  PeriodPreset,
  pctChange,
  resolvePeriod,
  summarize,
} from "../metrics";

/**
 * Portfolio summary: performance for every connected ad account in one
 * shape, plus per-currency totals. Provider-agnostic — depends on the
 * connector interface only, so a Google Ads connector plugs straight in.
 */

export interface AccountPerformance {
  account: AdAccount;
  /** null when this account's insights failed — see `error`. */
  kpis: {
    spend: number;
    conversions: number;
    cpa: number | null;
    spendDelta: number | null;
  } | null;
  /** Daily spend for the current period, oldest day first. */
  spendSeries: number[];
  error: ConnectorError["code"] | null;
}

/** Monetary totals only make sense within one currency, so totals are
 *  grouped — the UI decides how to present mixed-currency portfolios. */
export interface PortfolioTotals {
  currency: string;
  accounts: number;
  spend: number;
  conversions: number;
  spendDelta: number | null;
}

export interface PortfolioSummary {
  period: { preset: PeriodPreset; current: DateRange; previous: DateRange };
  accounts: AccountPerformance[];
  totals: PortfolioTotals[];
}

/** Run `fn` over items with at most `limit` in flight — Meta rate-limits
 *  per ad account and per app, so an unbounded fan-out invites 429s. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    })
  );
  return results;
}

export async function getPortfolioSummary(
  connector: AdPlatformConnector,
  accessToken: string,
  preset: PeriodPreset
): Promise<PortfolioSummary> {
  const { current, previous } = resolvePeriod(preset);
  const accounts = await connector.fetchAdAccounts(accessToken);

  const perAccount = await mapLimit(accounts, 5, async (account) => {
    try {
      const [currentDaily, previousTotals] = await Promise.all([
        connector.fetchInsights(accessToken, {
          accountExternalId: account.externalId,
          level: "account",
          range: current,
          daily: true,
        }),
        connector.fetchInsights(accessToken, {
          accountExternalId: account.externalId,
          level: "account",
          range: previous,
        }),
      ]);

      const kpis = summarize(currentDaily);
      const prevKpis = summarize(previousTotals);

      return {
        account,
        kpis: {
          spend: kpis.spend,
          conversions: kpis.conversions,
          cpa: kpis.cpa,
          spendDelta: pctChange(kpis.spend, prevKpis.spend),
        },
        spendSeries: currentDaily
          .filter((row) => row.date)
          .map((row) => row.metrics.spend),
        prevSpend: prevKpis.spend,
        error: null,
      };
    } catch (error) {
      // A dead token invalidates the whole request — surface it. Anything
      // account-specific (rate limit, permissions) degrades to one card.
      if (error instanceof ConnectorError && error.code !== "auth_expired") {
        return {
          account,
          kpis: null,
          spendSeries: [],
          prevSpend: 0,
          error: error.code,
        };
      }
      throw error;
    }
  });

  const byCurrency = new Map<
    string,
    { accounts: number; spend: number; prevSpend: number; conversions: number }
  >();
  for (const row of perAccount) {
    if (!row.kpis) continue;
    const t = byCurrency.get(row.account.currency) ?? {
      accounts: 0,
      spend: 0,
      prevSpend: 0,
      conversions: 0,
    };
    t.accounts += 1;
    t.spend += row.kpis.spend;
    t.prevSpend += row.prevSpend;
    t.conversions += row.kpis.conversions;
    byCurrency.set(row.account.currency, t);
  }

  const totals: PortfolioTotals[] = [...byCurrency.entries()]
    .map(([currency, t]) => ({
      currency,
      accounts: t.accounts,
      spend: t.spend,
      conversions: t.conversions,
      spendDelta: pctChange(t.spend, t.prevSpend),
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    period: { preset, current, previous },
    accounts: perAccount.map(({ account, kpis, spendSeries, error }) => ({
      account,
      kpis,
      spendSeries,
      error,
    })),
    totals,
  };
}
