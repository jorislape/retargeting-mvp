import { createHash } from "node:crypto";
import { diffPageSignals } from "../competitor/watchlist.ts";
import type { CompetitorPageSignals } from "../competitor/types.ts";

/**
 * Snapshot hashing + meaningful-change detection for the monitoring
 * beta. Pure functions over the SAME deterministic signal shapes the
 * manual watchlist uses — no new interpretation logic, no AI.
 *
 * Two separate questions, deliberately decoupled:
 *  - "Is this fetch's content identical?"  → contentHashOf(). Equal
 *    hash means record a no_change event and insert NO snapshot row.
 *  - "Did something meaningful change?"    → diffSnapshots(), the
 *    existing deterministic differ, driving the UI change indicator.
 * A snapshot can differ by hash (e.g. rawSummary text shifted) while
 * the differ honestly reports no meaningful change.
 */

export type ExtractionCompleteness = "full" | "partial";

/** What snapshots.signals_json holds. Versioned so a future shape
 *  change can migrate rather than guess. */
export interface StoredSnapshotSignals {
  v: 1;
  completeness: ExtractionCompleteness;
  signals: CompetitorPageSignals;
}

/**
 * Extraction completeness tier (Checkpoint-1-approved definition):
 * a usable extract missing the page's primary field (headline) is
 * "partial" — stored, but never diffed against a "full" snapshot.
 * (A totally empty extract never reaches here; that's
 * unsupported_content upstream.)
 */
export function completenessOf(
  signals: CompetitorPageSignals
): ExtractionCompleteness {
  return typeof signals.headline === "string" && signals.headline.trim() !== ""
    ? "full"
    : "partial";
}

const norm = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, " ").trim();

const STRING_FIELDS = [
  "headline",
  "cta",
  "offer",
  "positioning",
  "rawSummary",
] as const;
const LIST_FIELDS = ["benefits", "trustSignals"] as const;

/**
 * Canonical serialization: fixed field order, normalized strings
 * (case/whitespace), normalized+deduped lists, absent fields omitted.
 * Whitespace or casing churn on the page therefore does NOT create a
 * new snapshot — only signal-level change does.
 */
export function canonicalizeSignals(signals: CompetitorPageSignals): string {
  const parts: [string, string | string[]][] = [];
  for (const field of STRING_FIELDS) {
    const value = signals[field];
    if (typeof value === "string" && norm(value) !== "") {
      parts.push([field, norm(value)]);
    }
  }
  for (const field of LIST_FIELDS) {
    const value = signals[field];
    if (Array.isArray(value)) {
      const seen = new Set<string>();
      const list: string[] = [];
      for (const item of value) {
        if (typeof item !== "string") continue;
        const n = norm(item);
        if (n === "" || seen.has(n)) continue;
        seen.add(n);
        list.push(n);
      }
      if (list.length > 0) parts.push([field, list]);
    }
  }
  return JSON.stringify(parts);
}

/** SHA-256 hex over the canonical form — the snapshots.content_hash
 *  value. */
export function contentHashOf(signals: CompetitorPageSignals): string {
  return createHash("sha256").update(canonicalizeSignals(signals)).digest("hex");
}

export interface SnapshotDiff {
  /** Human-readable change lines (existing deterministic wording). */
  changes: string[];
  /** True when at least one real change was detected. */
  meaningful: boolean;
  /** True when the comparison was refused because the two snapshots
   *  have different extraction completeness — a partial extract
   *  diffed against a full one would report fields "disappearing"
   *  that the page never removed. */
  suppressed: boolean;
}

/** Keeps only the fields present (non-empty) in BOTH snapshots, so a
 *  field one extraction missed is never reported as a change. */
function intersectFields(
  a: CompetitorPageSignals,
  b: CompetitorPageSignals
): [CompetitorPageSignals, CompetitorPageSignals] {
  const fa: CompetitorPageSignals = {};
  const fb: CompetitorPageSignals = {};
  for (const field of STRING_FIELDS) {
    const va = a[field];
    const vb = b[field];
    if (typeof va === "string" && va !== "" && typeof vb === "string" && vb !== "") {
      fa[field] = va;
      fb[field] = vb;
    }
  }
  for (const field of LIST_FIELDS) {
    const va = a[field];
    const vb = b[field];
    if (Array.isArray(va) && va.length > 0 && Array.isArray(vb) && vb.length > 0) {
      fa[field] = va;
      fb[field] = vb;
    }
  }
  return [fa, fb];
}

export function diffSnapshots(
  prev: StoredSnapshotSignals,
  next: StoredSnapshotSignals
): SnapshotDiff {
  if (prev.completeness !== next.completeness) {
    return { changes: [], meaningful: false, suppressed: true };
  }
  const [a, b] = intersectFields(prev.signals, next.signals);
  const changes = diffPageSignals(a, b);
  const meaningful = changes.some(
    (c) => c !== "No meaningful change detected"
  );
  return { changes, meaningful, suppressed: false };
}

/** Defensive parse of signals_json coming back from the DB. */
export function parseStoredSnapshot(
  raw: unknown
): StoredSnapshotSignals | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (o.completeness !== "full" && o.completeness !== "partial") return null;
  if (o.signals === null || typeof o.signals !== "object") return null;
  return {
    v: 1,
    completeness: o.completeness,
    signals: o.signals as CompetitorPageSignals,
  };
}
