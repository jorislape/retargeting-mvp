/* ------------------------------------------------------------------ */
/* Deterministic monitoring rules. No AI, no statistics beyond ratio   */
/* comparisons — every finding is explainable from its stored metrics. */
/*                                                                     */
/* Windows (all ending yesterday — today's partial data never alerts,  */
/* matching the repo-wide convention in modules/metrics):              */
/*   current  = last 3 complete days                                   */
/*   baseline = the 14 days before the current window                  */
/* ------------------------------------------------------------------ */

export interface MonitorThresholds {
  cpaSpikePct: number;
  roasDropPct: number;
  spendConcentrationPct: number;
  zeroSpendFloor: number;
  cpaSpikeEnabled: boolean;
  roasDropEnabled: boolean;
  spendConcentrationEnabled: boolean;
  spendStoppedEnabled: boolean;
}

export const DEFAULT_THRESHOLDS: MonitorThresholds = {
  cpaSpikePct: 30,
  roasDropPct: 25,
  spendConcentrationPct: 60,
  zeroSpendFloor: 5,
  cpaSpikeEnabled: true,
  roasDropEnabled: true,
  spendConcentrationEnabled: true,
  spendStoppedEnabled: true,
};

/** Baseline needs at least this many conversions before CPA is signal. */
const MIN_BASELINE_CONVERSIONS = 5;

export type FindingRule =
  | "cpa_spike"
  | "roas_drop"
  | "spend_concentration"
  | "spend_stopped"
  | "account_disabled"
  | "connection_expired";

export interface RuleFinding {
  rule: FindingRule;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  metrics: Record<string, number | string | null>;
}

export interface RuleInput {
  accountName: string;
  accountStatus: string;
  currency: string;
  current: { spend: number; conversions: number; cpa: number | null; roas: number | null };
  baseline: { spend: number; conversions: number; cpa: number | null; roas: number | null };
  /** Spend on the most recent complete day (yesterday). */
  yesterdaySpend: number;
  /** Average daily spend over the 7 days before yesterday. */
  priorWeekAvgDailySpend: number;
  /** Campaigns aggregated over the current window, any order. */
  campaigns: { name: string | null; spend: number }[];
}

function money(value: number, currency: string): string {
  return `${currency} ${value.toFixed(2)}`;
}

export function evaluateRules(
  input: RuleInput,
  thresholds: MonitorThresholds
): RuleFinding[] {
  const out: RuleFinding[] = [];
  const { current, baseline, currency } = input;

  if (input.accountStatus === "disabled") {
    out.push({
      rule: "account_disabled",
      severity: "critical",
      title: `${input.accountName} is disabled on Meta's side`,
      detail:
        "The ad account status is 'disabled'. Delivery has stopped; check Meta Business Manager for the reason.",
      metrics: { status: input.accountStatus },
    });
  }

  if (
    thresholds.cpaSpikeEnabled &&
    current.cpa != null &&
    baseline.cpa != null &&
    baseline.conversions >= MIN_BASELINE_CONVERSIONS &&
    current.cpa > baseline.cpa * (1 + thresholds.cpaSpikePct / 100)
  ) {
    const risePct = ((current.cpa - baseline.cpa) / baseline.cpa) * 100;
    out.push({
      rule: "cpa_spike",
      severity: risePct >= thresholds.cpaSpikePct * 2 ? "critical" : "warning",
      title: `CPA up ${risePct.toFixed(0)}% vs the 14-day baseline`,
      detail: `Last 3 days: ${money(current.cpa, currency)} per conversion vs ${money(baseline.cpa, currency)} baseline (threshold ${thresholds.cpaSpikePct}%).`,
      metrics: {
        observedCpa: current.cpa,
        baselineCpa: baseline.cpa,
        thresholdPct: thresholds.cpaSpikePct,
        risePct: Math.round(risePct * 10) / 10,
      },
    });
  }

  if (
    thresholds.roasDropEnabled &&
    current.roas != null &&
    baseline.roas != null &&
    baseline.roas > 0 &&
    current.roas < baseline.roas * (1 - thresholds.roasDropPct / 100)
  ) {
    const dropPct = ((baseline.roas - current.roas) / baseline.roas) * 100;
    out.push({
      rule: "roas_drop",
      severity: dropPct >= thresholds.roasDropPct * 2 ? "critical" : "warning",
      title: `ROAS down ${dropPct.toFixed(0)}% vs the 14-day baseline`,
      detail: `Last 3 days: ${current.roas.toFixed(2)}x vs ${baseline.roas.toFixed(2)}x baseline (threshold ${thresholds.roasDropPct}%).`,
      metrics: {
        observedRoas: current.roas,
        baselineRoas: baseline.roas,
        thresholdPct: thresholds.roasDropPct,
        dropPct: Math.round(dropPct * 10) / 10,
      },
    });
  }

  if (
    thresholds.spendConcentrationEnabled &&
    current.spend > 0 &&
    input.campaigns.length >= 2
  ) {
    const top = [...input.campaigns].sort((a, b) => b.spend - a.spend)[0];
    const sharePct = (top.spend / current.spend) * 100;
    if (sharePct >= thresholds.spendConcentrationPct) {
      out.push({
        rule: "spend_concentration",
        severity: "info",
        title: `${sharePct.toFixed(0)}% of spend sits in one campaign`,
        detail: `“${top.name ?? "Unnamed campaign"}” carries ${money(top.spend, currency)} of ${money(current.spend, currency)} over the last 3 days (threshold ${thresholds.spendConcentrationPct}%). Account results move with this single campaign.`,
        metrics: {
          topCampaign: top.name,
          sharePct: Math.round(sharePct * 10) / 10,
          thresholdPct: thresholds.spendConcentrationPct,
        },
      });
    }
  }

  if (
    thresholds.spendStoppedEnabled &&
    input.yesterdaySpend === 0 &&
    input.priorWeekAvgDailySpend > thresholds.zeroSpendFloor
  ) {
    out.push({
      rule: "spend_stopped",
      severity: "critical",
      title: "Spend stopped — zero delivery yesterday",
      detail: `The account spent nothing yesterday after averaging ${money(input.priorWeekAvgDailySpend, currency)}/day over the prior week. Check budgets, payment method, and campaign status.`,
      metrics: {
        yesterdaySpend: 0,
        priorWeekAvgDailySpend:
          Math.round(input.priorWeekAvgDailySpend * 100) / 100,
        floor: thresholds.zeroSpendFloor,
      },
    });
  }

  return out;
}
