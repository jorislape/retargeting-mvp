import { fmtMoney } from "./data";

/* ------------------------------------------------------------------ */
/* Rule-based interpretation of data the app already fetches.          */
/*                                                                     */
/* Research: media buyers don't struggle to SEE numbers — they lose    */
/* time working out why numbers moved and what to do next. These       */
/* functions turn the existing deltas + campaign table into plain-     */
/* language findings. Deterministic and transparent by design: every   */
/* sentence is derived from figures visible on the same screen, and    */
/* the UI labels it as computed, not AI-generated.                     */
/* ------------------------------------------------------------------ */

/** Movements under this % are treated as noise, not signal. */
const FLAT_THRESHOLD = 3;

function pct(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`;
}

function isUp(value: number | null | undefined): value is number {
  return value != null && value >= FLAT_THRESHOLD;
}

function isDown(value: number | null | undefined): value is number {
  return value != null && value <= -FLAT_THRESHOLD;
}

export interface AccountAnalysis {
  headline: string;
  points: string[];
}

export function analyzeAccount(input: {
  kpis: {
    spend: number;
    conversions: number;
    cpa: number | null;
    roas: number | null;
  };
  deltas: Record<string, number | null>;
  campaigns: {
    id: string;
    name: string | null;
    spend: number;
    cpa: number | null;
  }[];
  currency: string;
}): AccountAnalysis {
  const { kpis, deltas, campaigns, currency } = input;
  const spend = deltas.spend ?? null;
  const cpa = deltas.cpa ?? null;
  const conversions = deltas.conversions ?? null;
  const roas = deltas.roas ?? null;

  /* Headline: the spend × CPA quadrant is the story a media buyer
     reads first — efficiency vs scale. */
  let headline = "Performance is broadly stable versus the previous period.";
  if (isUp(spend) && isDown(cpa)) {
    headline = `Efficiency improved while scaling — spend rose ${pct(spend)} and CPA still fell ${pct(cpa)}.`;
  } else if (isUp(spend) && isUp(cpa)) {
    headline = `Scaling is getting more expensive — spend rose ${pct(spend)} and CPA climbed ${pct(cpa)} with it.`;
  } else if (isDown(spend) && isDown(cpa)) {
    headline = `Spend pulled back ${pct(spend)} and CPA improved ${pct(cpa)} — there may be room to re-scale.`;
  } else if (isDown(spend) && isUp(cpa)) {
    headline = `CPA rose ${pct(cpa)} despite ${pct(spend)} lower spend — worth checking creative fatigue or audience overlap.`;
  } else if (isUp(conversions)) {
    headline = `Conversions grew ${pct(conversions)} on broadly flat spend.`;
  } else if (isDown(conversions)) {
    headline = `Conversions fell ${pct(conversions)} on broadly flat spend.`;
  }

  const points: string[] = [];

  if (roas != null && Math.abs(roas) >= FLAT_THRESHOLD) {
    points.push(
      roas > 0
        ? `Return improved: ROAS is up ${pct(roas)} period over period.`
        : `Return weakened: ROAS is down ${pct(roas)} period over period.`
    );
  }

  /* Concentration: when one campaign dominates, the account's numbers
     are really that campaign's numbers. */
  if (kpis.spend > 0 && campaigns.length > 1) {
    const topSpender = [...campaigns].sort((a, b) => b.spend - a.spend)[0];
    const share = (topSpender.spend / kpis.spend) * 100;
    if (share >= 40) {
      points.push(
        `“${topSpender.name ?? topSpender.id}” carries ${share.toFixed(0)}% of spend — account results move with it.`
      );
    }

    /* CPA spread across meaningful spenders → the fastest next test is
       comparing what the winner does differently. */
    const significant = campaigns.filter(
      (c) => c.cpa != null && c.spend >= kpis.spend * 0.1
    );
    if (significant.length >= 2) {
      const best = significant.reduce((a, b) => (a.cpa! <= b.cpa! ? a : b));
      const worst = significant.reduce((a, b) => (a.cpa! >= b.cpa! ? a : b));
      if (best.id !== worst.id && worst.cpa! > best.cpa! * 1.5) {
        points.push(
          `CPA spread is wide: ${fmtMoney(best.cpa, currency)} on “${best.name ?? best.id}” vs ${fmtMoney(worst.cpa, currency)} on “${worst.name ?? worst.id}” — comparing their creative and audiences is the cheapest next test.`
        );
      }
    }
  }

  return { headline, points: points.slice(0, 3) };
}

/* ------------------------------------------------------------------ */
/* Portfolio triage: which accounts deserve a look first.              */
/* ------------------------------------------------------------------ */

export interface AttentionItem {
  severity: "warn" | "info";
  accountId: string;
  accountName: string;
  text: string;
}

export function findAttention(
  rows: {
    account: {
      externalId: string;
      name: string;
      status: string;
    };
    kpis: { spend: number; spendDelta: number | null } | null;
    error: string | null;
  }[]
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const row of rows) {
    const base = {
      accountId: row.account.externalId,
      accountName: row.account.name,
    };
    if (row.account.status === "disabled") {
      items.push({
        ...base,
        severity: "warn",
        text: "Account is disabled on Meta's side",
      });
    }
    if (row.error) {
      items.push({
        ...base,
        severity: "info",
        text:
          row.error === "rate_limited"
            ? "Performance data rate-limited — retry in a minute"
            : "Performance data unavailable",
      });
      continue;
    }
    const delta = row.kpis?.spendDelta ?? null;
    if (delta != null && delta <= -20) {
      items.push({
        ...base,
        severity: "warn",
        text: `Spend down ${Math.abs(delta).toFixed(0)}% vs the previous week`,
      });
    } else if (delta != null && delta >= 30) {
      items.push({
        ...base,
        severity: "warn",
        text: `Spend up ${delta.toFixed(0)}% vs the previous week — check pacing`,
      });
    }
  }

  return items
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1))
    .slice(0, 5);
}
