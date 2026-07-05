import type { CompetitorPageSignals } from "./types";

/**
 * Competitor Watchlist V1 — a SMALL, manual, browser-local layer over
 * the existing one-time page fetch.
 *
 * What it is: up to 5 competitor pages the user saves locally, each
 * refreshable by an explicit click of "Refresh signals" (which calls
 * the same guarded /api/competitor/fetch-page route — same SSRF
 * protection, same Ads-Library refusal). The latest signals and the
 * previous snapshot are kept so a simple deterministic diff can say
 * what changed between two MANUAL refreshes.
 *
 * What it is NOT: monitoring. Nothing refreshes on a schedule, in the
 * background, or on page load; there are no alerts; nothing reaches
 * the report until the user appends the signals to market notes.
 *
 * Storage: localStorage ONLY (key below) — the single approved
 * browser-persistence exception in this product, and it holds nothing
 * but user-entered competitor info + fetched public-page signal
 * summaries. Never CSV data, memos, or tokens. If localStorage is
 * unavailable (private mode, disabled), everything still works in
 * session memory and simply doesn't survive a refresh.
 *
 * This file must stay free of runtime imports (type-only is fine) so
 * scripts/watchlist.test.ts can run it directly under Node.
 */

export interface WatchlistItem {
  name: string;
  url: string;
  notes: string;
  /** Latest fetched signals; null until the first manual refresh. */
  signals: CompetitorPageSignals | null;
  /** The snapshot the previous refresh produced — diff input. */
  previousSignals: CompetitorPageSignals | null;
  /** ISO timestamp of the latest manual refresh. */
  refreshedAt: string | null;
}

export const MAX_WATCHLIST_ITEMS = 5;

export const EMPTY_WATCHLIST_ITEM: WatchlistItem = {
  name: "",
  url: "",
  notes: "",
  signals: null,
  previousSignals: null,
  refreshedAt: null,
};

/* ----------------------- stored-shape validation ------------------ */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

function sanitizeSignals(v: unknown): CompetitorPageSignals | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const list = (x: unknown): string[] | undefined =>
    Array.isArray(x)
      ? x.filter((s): s is string => typeof s === "string").slice(0, 8)
      : undefined;
  const out: CompetitorPageSignals = {
    ...(typeof o.headline === "string" && { headline: o.headline }),
    ...(typeof o.cta === "string" && { cta: o.cta }),
    ...(typeof o.offer === "string" && { offer: o.offer }),
    ...(typeof o.positioning === "string" && { positioning: o.positioning }),
    ...(list(o.benefits) && { benefits: list(o.benefits) }),
    ...(list(o.trustSignals) && { trustSignals: list(o.trustSignals) }),
    ...(typeof o.rawSummary === "string" && { rawSummary: o.rawSummary }),
  };
  return Object.keys(out).length > 0 ? out : null;
}

/** Anything parsed from storage passes through here — corrupted or
 *  foreign data degrades to a safe shape, never a crash. */
export function sanitizeWatchlist(parsed: unknown): WatchlistItem[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, MAX_WATCHLIST_ITEMS).map((raw) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      name: str(o.name).slice(0, 200),
      url: str(o.url).slice(0, 2000),
      notes: str(o.notes).slice(0, 2000),
      signals: sanitizeSignals(o.signals),
      previousSignals: sanitizeSignals(o.previousSignals),
      refreshedAt: strOrNull(o.refreshedAt),
    };
  });
}

/* ----------------------- browser-local store ---------------------- */
/* A tiny external store (for useSyncExternalStore): in-memory source
   of truth, mirrored to localStorage when available. Server snapshot
   is always empty — items appear right after hydration. */

const STORAGE_KEY = "debrief.competitorWatchlist.v1";
const EMPTY: WatchlistItem[] = [];

let items: WatchlistItem[] | null = null; // null = not read yet
const listeners = new Set<() => void>();

function readStorage(): WatchlistItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === "") return EMPTY;
    const parsed = sanitizeWatchlist(JSON.parse(raw));
    return parsed.length > 0 ? parsed : EMPTY;
  } catch {
    return EMPTY; // unavailable/corrupted → session memory only
  }
}

export function getWatchlistSnapshot(): WatchlistItem[] {
  if (items === null) {
    items = typeof window === "undefined" ? EMPTY : readStorage();
  }
  return items;
}

export function getWatchlistServerSnapshot(): WatchlistItem[] {
  return EMPTY;
}

export function subscribeWatchlist(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replaces the watchlist (capped) in memory and, when available, in
 *  localStorage. A storage failure is silent by design — the session
 *  keeps working, it just won't survive a refresh. */
export function setWatchlist(next: WatchlistItem[]): void {
  items = next.slice(0, MAX_WATCHLIST_ITEMS);
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    /* localStorage unavailable — in-memory only */
  }
  for (const listener of listeners) listener();
}

/* ----------------------------- diffing ---------------------------- */

const norm = (s: string | undefined): string =>
  (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** Deterministic, deliberately simple: normalized string comparison
 *  per field, plus newly-appearing benefits/trust labels. Says what
 *  changed between two manual refreshes — never why, never a
 *  performance claim. */
export function diffPageSignals(
  prev: CompetitorPageSignals,
  next: CompetitorPageSignals
): string[] {
  const changes: string[] = [];
  if (norm(prev.headline) !== norm(next.headline)) changes.push("Headline changed");
  if (norm(prev.cta) !== norm(next.cta)) changes.push("CTA changed");
  if (norm(prev.offer) !== norm(next.offer)) changes.push("Offer changed");
  if (norm(prev.positioning) !== norm(next.positioning)) {
    changes.push("Positioning changed");
  }
  const fresh = (a: string[] | undefined, b: string[] | undefined): string[] => {
    const seen = new Set((a ?? []).map(norm));
    return (b ?? []).filter((x) => !seen.has(norm(x)));
  };
  const newBenefits = fresh(prev.benefits, next.benefits);
  if (newBenefits.length > 0) {
    changes.push(`New benefit detected: ${newBenefits.join(", ")}`);
  }
  const newTrust = fresh(prev.trustSignals, next.trustSignals);
  if (newTrust.length > 0) {
    changes.push(`New trust signal detected: ${newTrust.join(", ")}`);
  }
  return changes.length > 0 ? changes : ["No meaningful change detected"];
}

/* ----------------------- notes serialization ---------------------- */

export const WATCHLIST_CAVEAT =
  "These signals are observed from public pages only. Debrief uses them as directional creative context, but does not infer competitor spend, traffic, or performance.";

function displayName(item: WatchlistItem): string {
  if (item.name.trim() !== "") return item.name.trim();
  try {
    return new URL(item.url.trim()).hostname;
  } catch {
    return "(unnamed)";
  }
}

/**
 * Serializes every refreshed item into a market-notes block, or null
 * when nothing has been refreshed yet. Pure restatement of fetched
 * "observed on page" signals, with the diff lines when a previous
 * snapshot exists. Append it with the existing dedupe-append helper —
 * an unchanged block can't duplicate itself.
 */
export function formatWatchlistSignalsAsNotes(
  list: WatchlistItem[]
): string | null {
  const refreshed = list.filter((i) => i.signals !== null);
  if (refreshed.length === 0) return null;

  const lines: string[] = ["Competitor watchlist signals — directional only:"];
  for (const item of refreshed) {
    const s = item.signals as CompetitorPageSignals;
    lines.push(`- Competitor: ${displayName(item)}`);
    if (item.url.trim() !== "") lines.push(`  URL: ${item.url.trim()}`);
    if (item.refreshedAt) {
      lines.push(`  Last refreshed: ${item.refreshedAt.slice(0, 10)}`);
    }
    lines.push("  Observed on page:");
    if (s.headline) lines.push(`  - Headline: ${s.headline}`);
    const offerCta = [s.offer, s.cta ? `CTA "${s.cta}"` : null].filter(Boolean);
    if (offerCta.length > 0) lines.push(`  - CTA / offer: ${offerCta.join(" · ")}`);
    if (s.positioning) lines.push(`  - Positioning: ${s.positioning}`);
    if (s.benefits && s.benefits.length > 0) {
      lines.push(`  - Claims / benefits: ${s.benefits.join(", ")}`);
    }
    if (s.trustSignals && s.trustSignals.length > 0) {
      lines.push(`  - Trust signals: ${s.trustSignals.join(", ")}`);
    }
    if (item.previousSignals) {
      lines.push("  Changes:");
      for (const change of diffPageSignals(item.previousSignals, s)) {
        lines.push(`  - ${change}`);
      }
    }
  }
  lines.push(`Caveat: ${WATCHLIST_CAVEAT}`);
  return lines.join("\n");
}
