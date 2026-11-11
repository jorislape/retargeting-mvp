import type { ColumnMap, ColumnSource } from "./columns";

/**
 * Robustness 5 — Meta's "Results" columns are typed per row.
 *
 * "Results", "Cost per results", "Results value" and "Results ROAS"
 * count whatever each campaign optimises for, and the export says which
 * on every row in "Result indicator" (e.g.
 * "actions:offsite_conversion.fb_pixel_purchase", "actions:lead",
 * "actions:onsite_conversion.messaging_conversation_started_7d"). Read
 * blindly as purchases, a lead campaign's 120 leads became 120
 * purchases and its cost per lead a purchase CPA, ranked on one median
 * with real purchase ads.
 *
 * With a Result indicator column the Results family is read by row:
 *  - "purchase": at least one row is a purchase result — the family is
 *    read as purchases on purchase rows only; other rows are unknown
 *    (never zero) for every purchase number.
 *  - "lead": no purchase rows but lead rows — the family is read as
 *    Leads / Cost per lead on lead rows, and not as purchases at all.
 *  - "none": only other results (messaging, clicks, reach…) — not read
 *    as purchases or leads; Cost per conversation reads messaging rows
 *    itself (extract.ts conversationsForRow).
 * Without a Result indicator column nothing changes (the existing
 * "Meta's optimisation event — check it's the conversion you mean"
 * disclosure applies).
 *
 * Pure: returns new rows / a new ColumnMap, never mutates its input,
 * and is idempotent (a typed ColumnMap passes straight through).
 */

export type ResultKind = "purchase" | "lead" | "conversation" | "other";

/** What a Result indicator cell says the row's Results count. A ROAS
 *  indicator means Results is a ratio, not a count — never a purchase
 *  count. Blank ⇒ null (the row recorded no result). */
export function resultKind(indicator: string | undefined): ResultKind | null {
  const v = (indicator ?? "").trim().toLowerCase();
  if (v === "") return null;
  if (/roas/.test(v)) return "other";
  if (/messag|conversation/.test(v)) return "conversation";
  if (/purchase/.test(v)) return "purchase";
  if (/lead/.test(v)) return "lead";
  return "other";
}

/** Hidden row keys (never a real header — they start with NUL). */
export const RESULT_ROW_NOT_READ = "\u0000results-not-read";
export const RESULT_ROW_RAW = "\u0000results-raw";

export interface ResultsTyping {
  read: "purchase" | "lead" | "none";
  /** Rows per kind (rows with a blank indicator aren't counted). */
  rows: Record<ResultKind, number>;
}

export function applyResultIndicator(
  rows: Record<string, string>[],
  columns: ColumnMap
): { rows: Record<string, string>[]; columns: ColumnMap } {
  const { results, resultIndicator } = columns;
  if (columns.resultsTyping || !results || !resultIndicator) return { rows, columns };
  const kinds = rows.map((r) => resultKind(r[resultIndicator]));
  const counts: Record<ResultKind, number> = { purchase: 0, lead: 0, conversation: 0, other: 0 };
  for (const k of kinds) if (k) counts[k] += 1;
  if (counts.purchase + counts.lead + counts.conversation + counts.other === 0) return { rows, columns };

  /* Which purchase fields this export reads from the Results family. */
  const via = {
    purchases: columns.purchases === results,
    costPerPurchase: columns.costPerPurchase != null && columns.costPerPurchase === columns.costPerResult,
    purchaseValue: columns.purchaseValue != null && columns.purchaseValue === columns.resultsValue,
    purchaseRoas: columns.purchaseRoas != null && columns.purchaseRoas === columns.resultsRoas,
  };
  if (!via.purchases && !via.costPerPurchase && !via.purchaseValue && !via.purchaseRoas) return { rows, columns };

  const read: ResultsTyping["read"] = counts.purchase > 0 ? "purchase" : counts.lead > 0 ? "lead" : "none";
  const family = [results, columns.costPerResult, columns.resultsValue, columns.resultsRoas].filter((h): h is string => h != null);
  /** Blanks the Results family on rows of another kind; the raw count
   *  is kept for the Cost-per-conversation reader. */
  const project = (keep: ResultKind) =>
    rows.map((row, i) => {
      const kind = kinds[i];
      if (kind == null || kind === keep) return row;
      const out: Record<string, string> = { ...row, [RESULT_ROW_NOT_READ]: "1", [RESULT_ROW_RAW]: row[results] ?? "" };
      for (const h of family) out[h] = "";
      return out;
    });

  const typing: ResultsTyping = { read, rows: counts };
  if (read === "purchase") return { rows: project("purchase"), columns: { ...columns, resultsTyping: typing } };

  /* No purchase rows: the family is not purchases at all. */
  const sources: ColumnMap["sources"] = { ...columns.sources };
  const next: ColumnMap = { ...columns, sources, resultsTyping: typing };
  if (via.purchases) {
    next.purchases = null;
    delete sources.purchases;
  }
  if (via.costPerPurchase) {
    next.costPerPurchase = null;
    delete sources.costPerPurchase;
  }
  if (via.purchaseValue) {
    next.purchaseValue = null;
    delete sources.purchaseValue;
  }
  if (via.purchaseRoas) {
    next.purchaseRoas = null;
    delete sources.purchaseRoas;
  }
  if (read === "none") return { rows, columns: next };

  const asResults = (header: string): ColumnSource => ({ header, match: "results", ignored: [] });
  if (next.leads == null) {
    next.leads = results;
    sources.leads = asResults(results);
  }
  if (next.costPerLead == null && columns.costPerResult) {
    next.costPerLead = columns.costPerResult;
    sources.costPerLead = asResults(columns.costPerResult);
  }
  return { rows: next.leads === results ? project("lead") : rows, columns: next };
}

const KIND_LABEL: Record<ResultKind, string> = {
  purchase: "purchase",
  lead: "lead",
  conversation: "messaging conversation",
  other: "other",
};

/** The file card's line about how Results was read — null when the
 *  export has no typed Results, or every row is a purchase result. */
export function resultsTypingNote(columns: ColumnMap): string | null {
  const t = columns.resultsTyping;
  if (!t) return null;
  const kinds = (["purchase", "lead", "conversation", "other"] as const).filter((k) => t.rows[k] > 0);
  const list = (ks: readonly ResultKind[]) => ks.map((k) => `${t.rows[k]} ${KIND_LABEL[k]}`).join(", ");
  const rowsWord = (n: number) => `row${n === 1 ? "" : "s"}`;
  if (t.read === "purchase") {
    const others = kinds.filter((k) => k !== "purchase");
    if (others.length === 0) return null;
    const n = others.reduce((sum, k) => sum + t.rows[k], 0);
    return `Results read by Result indicator: ${t.rows.purchase} purchase ${rowsWord(t.rows.purchase)} counted as purchases; ${n} ${rowsWord(n)} with another result (${list(others)}) ${
      n === 1 ? "is" : "are"
    } not purchases and ${n === 1 ? "has" : "have"} no purchase numbers.`;
  }
  if (t.read === "lead") {
    const others = kinds.filter((k) => k !== "lead");
    const n = others.reduce((sum, k) => sum + t.rows[k], 0);
    return `Results are leads in this file (Result indicator) — read as leads, not purchases.${
      n > 0 ? ` ${n} ${rowsWord(n)} with another result (${list(others)}) ${n === 1 ? "is" : "are"} not counted as leads.` : ""
    }`;
  }
  return `Results in this file are not purchases or leads (Result indicator: ${list(kinds)}) — not read as either.${
    t.rows.conversation > 0 ? " Pick Cost per conversation to judge messaging ads." : ""
  }`;
}
