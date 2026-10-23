/**
 * Real-account fix 8 — Patterns by naming. Agency accounts encode the
 * creative brief in the ad name ("[VAR]ORG_[SKU]00229_[FOR]UGC_[AN]QUAL_
 * [STG]TOFU_…"), which the keyword tags in extract.ts mostly can't read,
 * so a real export's Patterns said "No clear ad-name pattern" while every
 * name carried format, angle, hook and stage. This reads those tokens and
 * reports spend, outcomes and the blended KPI per value.
 *
 * Display-only, decision-blind (same isolation pattern as
 * segmentSpread.ts / funnelStages.ts): it re-reads ads the analysis
 * already extracted and never touches the gate, median, ranking, action
 * or evidenceState. Descriptive only — a token's blended result is an
 * association in this export, never a cause.
 */
import { computeAccountKpi } from "./accountKpi.ts";
import { HIGHER_IS_BETTER, type KpiKey, type NamingPatternRow, type NamingPatterns, type ParsedAd } from "./types.ts";

/** Share of ALL analyzed ads that must carry tokens (judged ads, for
 *  the "_" layout fallback) before names are read as a convention. */
export const NAMING_MIN_SHARE = 0.5;
/** …or the share of JUDGED SPEND on tokened ads: an account whose newer
 *  low-spend ads are tokened but whose big spenders aren't still has its
 *  money described (a real export: 75% of ads tokened, 42% of judged). */
export const NAMING_MIN_JUDGED_SPEND_SHARE = 0.3;
/** A value is listed only with at least this multiple of the minimum
 *  spend behind it — less is too thin to compare. */
export const NAMING_MIN_GATE_MULTIPLE = 2;
/** Keys read first, in this order, whenever present. */
export const PREFERRED_NAMING_KEYS = ["FOR", "AN", "HK", "STG"] as const;
const MAX_KEYS = 6;
const MAX_VALUES_PER_KEY = 12;
/** "_" segment layouts need at least this many parts to count as a
 *  convention (3-part names like "UGC_MorningRoutine_V1" are prose). */
const MIN_SEGMENTS = 4;

const TOKEN = /\[([A-Z][A-Z0-9]{0,7})\]([^[]*)/g;

/** Strips a trailing "- Copy" / "– Copy" and separator noise. */
function clean(value: string): string {
  return value
    .replace(/\s*[-–—]\s*Copy(?:\s*\d+)?\s*$/i, "")
    .replace(/^[\s_\-.]+|[\s_\-.]+$/g, "");
}

/** `[KEY]VALUE` tokens in a name (empty values dropped). */
export function parseNameTokens(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of name.matchAll(TOKEN)) {
    const value = clean(m[2]);
    if (value !== "" && !(m[1] in out)) out[m[1]] = value;
  }
  return out;
}

function keysFor(
  ads: readonly ParsedAd[],
  labels: Map<string, Record<string, string>>,
  preferred: readonly string[]
): string[] {
  const coverage = new Map<string, Set<string>>();
  const present = new Map<string, number>();
  for (const ad of ads) {
    for (const [k, v] of Object.entries(labels.get(ad.name) ?? {})) {
      present.set(k, (present.get(k) ?? 0) + 1);
      coverage.set(k, (coverage.get(k) ?? new Set()).add(v));
    }
  }
  const tokened = ads.filter((a) => Object.keys(labels.get(a.name) ?? {}).length > 0).length;
  const usable = (k: string) => {
    const n = coverage.get(k)?.size ?? 0;
    return n >= 2 && n <= MAX_VALUES_PER_KEY;
  };
  const first = preferred.filter((k) => present.has(k) && usable(k));
  const rest = [...present.keys()]
    .filter((k) => !first.includes(k) && usable(k) && (present.get(k) ?? 0) >= NAMING_MIN_SHARE * tokened)
    .sort();
  return [...first, ...rest];
}

/**
 * null unless the names follow a convention: `[KEY]VALUE` tokens on ≥
 * NAMING_MIN_SHARE of all ads OR on ads holding ≥
 * NAMING_MIN_JUDGED_SPEND_SHARE of judged spend; else (only if
 * consistent) one "_" layout of ≥ MIN_SEGMENTS parts shared by ≥
 * NAMING_MIN_SHARE of the judged ads. Rows aggregate EVERY analyzed ad
 * carrying the value (set-aside ads too — spend-weighted, so thin ads
 * barely move it) and are listed only with ≥ NAMING_MIN_GATE_MULTIPLE ×
 * the minimum spend; a key needs ≥2 such values to say anything.
 */
export function detectNamingPatterns(
  ads: readonly ParsedAd[],
  judged: readonly ParsedAd[],
  kpi: KpiKey,
  spendGate: number
): NamingPatterns | null {
  if (judged.length === 0) return null;
  /* Keyed by name — judged ads are gated copies, not the same objects,
     and names are unique per report (extract.ts merges duplicates). */
  const labels = new Map<string, Record<string, string>>();
  let basis: NamingPatterns["basis"] = "tokens";
  for (const ad of ads) labels.set(ad.name, parseNameTokens(ad.name));
  const tokened = (a: ParsedAd) => Object.keys(labels.get(a.name) ?? {}).length > 0;
  const judgedSpend = judged.reduce((s, a) => s + a.spend, 0);
  const spendShare = (match: (a: ParsedAd) => boolean) =>
    judgedSpend > 0 ? judged.filter(match).reduce((s, a) => s + a.spend, 0) / judgedSpend : 0;
  let matched = ads.filter(tokened).length;
  let total = ads.length;
  let judgedSpendShare = spendShare(tokened);

  if (matched < NAMING_MIN_SHARE * total && judgedSpendShare < NAMING_MIN_JUDGED_SPEND_SHARE) {
    // Fallback: a consistent "_" layout, read positionally.
    const parts = (a: ParsedAd) => clean(a.name).split("_").map((p) => p.trim());
    const counts = new Map<number, number>();
    for (const a of judged) counts.set(parts(a).length, (counts.get(parts(a).length) ?? 0) + 1);
    const [layout, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (layout < MIN_SEGMENTS || n < NAMING_MIN_SHARE * judged.length) return null;
    basis = "segments";
    matched = n;
    total = judged.length;
    judgedSpendShare = spendShare((a) => parts(a).length === layout);
    for (const ad of ads) {
      const p = parts(ad);
      labels.set(
        ad.name,
        p.length === layout ? Object.fromEntries(p.map((v, i) => [`Part ${i + 1}`, v]).filter(([, v]) => v !== "")) : {}
      );
    }
  }

  const minSpend = NAMING_MIN_GATE_MULTIPLE * spendGate;
  const better = HIGHER_IS_BETTER[kpi];
  const keys: NamingPatterns["keys"] = [];
  for (const key of keysFor(ads, labels, basis === "tokens" ? PREFERRED_NAMING_KEYS : [])) {
    const byValue = new Map<string, ParsedAd[]>();
    for (const ad of ads) {
      const v = labels.get(ad.name)?.[key];
      if (v != null) byValue.set(v, [...(byValue.get(v) ?? []), ad]);
    }
    const rows: NamingPatternRow[] = [...byValue.entries()]
      .map(([value, group]) => {
        const spend = group.reduce((s, a) => s + a.spend, 0);
        const counts = group.map((a) => a.conversions);
        return {
          value,
          ads: group.length,
          spend,
          outcomes: counts.every((c) => c != null) ? (counts as number[]).reduce((s, c) => s + c, 0) : null,
          kpiValue: computeAccountKpi(group, kpi)?.value ?? null,
        };
      })
      .filter((r) => r.spend >= minSpend)
      .sort((a, b) =>
        a.kpiValue == null ? 1 : b.kpiValue == null ? -1 : better ? b.kpiValue - a.kpiValue : a.kpiValue - b.kpiValue
      );
    if (rows.length >= 2) keys.push({ key, rows });
    if (keys.length >= MAX_KEYS) break;
  }
  if (keys.length === 0) return null;
  return { basis, coverage: { matched, total, judgedSpendShare }, minSpend, keys };
}
