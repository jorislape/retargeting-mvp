/**
 * Bulletproof pass B6 — currency and dates.
 *
 * Money carries the export's own currency symbol ("€1,234.00", "€1" in
 * the ROAS definition) — never a hard-coded "$"; a code without a common
 * symbol keeps the code, and an export with no currency code gets no
 * symbol at all. Dates and times read ISO in both views
 * ("2026-10-24 12:38"). The client never reads "your CSV" / "not a
 * model" — "Based on the exported ad data." instead.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const { run, buildSampleMemo, memoToText, requireCompiled, cleanup } = loadEngine();
try {
  const { fmtMoney } = requireCompiled("modules/debrief/format.js") as { fmtMoney: (v: number, c: string | null) => string };
  assert.equal(fmtMoney(1234.5, "EUR"), "€1,234.50");
  assert.equal(fmtMoney(1234.5, "GBP"), "£1,234.50");
  assert.equal(fmtMoney(1234.5, "USD"), "$1,234.50");
  assert.equal(fmtMoney(1234.5, "SEK"), "1,234.50 SEK", "no common symbol ⇒ the code");
  assert.equal(fmtMoney(1234.5, null), "1,234.50", "no code ⇒ no invented symbol");

  const { isoDate } = requireCompiled("modules/debrief/analysis.js") as { isoDate: (s: string) => string };
  assert.equal(isoDate("2025-04-01"), "2025-04-01");
  assert.equal(isoDate("2025/4/1"), "2025-04-01");
  assert.equal(isoDate("30/04/2025"), "2025-04-30", "day over 12 ⇒ D/M/Y");
  assert.equal(isoDate("04/30/2025"), "2025-04-30", "day over 12 ⇒ M/D/Y");
  assert.equal(isoDate("03/04/2025"), "03/04/2025", "ambiguous ⇒ kept as exported, never guessed");

  /* ---- EUR export: € everywhere, both views ---- */
  const eur = run(AGENCY, "roas");
  assert.equal(eur.memo.scope.kpiExplainer, "Return on ad spend — revenue earned for every €1 spent on ads");
  for (const [view, strings] of [
    ["client", [...clientStrings(eur.memo), ...eur.clientText.split("\n")]],
    ["buyer", eur.buyerText.split("\n")],
  ] as const)
    for (const s of strings) {
      assert.ok(!/(?<![A-Z])\$\d/.test(s), `${view}: no "$" in a EUR export: ${s.slice(0, 120)}`);
      assert.ok(!/\d EUR\b/.test(s), `${view}: symbol, not code: ${s.slice(0, 120)}`);
    }
  assert.match(eur.memo.scope.totalSpendLabel, /^€[\d,]+\.\d{2}$/);

  /* ---- No currency code: no symbol is invented ---- */
  const bare = run(AGENCY.replace("Amount spent (EUR)", "Amount spent"), "roas");
  assert.equal(bare.memo.scope.kpiExplainer, "Return on ad spend — revenue earned for every unit of currency spent on ads");
  assert.ok(!/(?<![A-Z])\$\d/.test(bare.buyerText + bare.clientText), "no hard-coded $");

  /* ---- Sample (USD) unchanged ---- */
  const sample = buildSampleMemo();
  assert.match(sample.scope.totalSpendLabel, /^\$[\d,]+\.\d{2}$/);
  assert.equal(sample.scope.dateRangeLabel, "2026-06-01 – 2026-06-30");

  /* ---- ISO timestamps; no locale-formatted dates in the report ---- */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.ok(!/toLocale(Date|Time)?String\(\)/.test(report), "no locale date formatting in the report");
  assert.match(report, /`Generated \$\{isoDateTime\(generatedAt\)\}`/);
  assert.match(report, /` on \$\{isoDateTime\(generatedAt\)\}`/);
  const iso = report.slice(report.indexOf("function isoDateTime("), report.indexOf("const TIP_BELOW_BENCHMARK"));
  assert.match(iso, /\$\{d\.getFullYear\(\)\}-\$\{p\(d\.getMonth\(\) \+ 1\)\}-\$\{p\(d\.getDate\(\)\)\} \$\{p\(d\.getHours\(\)\)\}:\$\{p\(d\.getMinutes\(\)\)\}/);

  /* ---- Client data-source wording ---- */
  assert.match(report, /\? "Based on the exported ad data\."\s*: "Deterministic scoring — every number above comes from your CSV, not a model\."/);
  for (const m of [eur.memo, sample]) {
    const text = memoToText(m, "client", 3, []);
    for (const s of [...clientStrings(m), ...text.split("\n")])
      assert.ok(!/\byour CSV\b|\bnot a model\b/i.test(s), `client: ${s.slice(0, 120)}`);
  }

  console.log("bulletproof currency and dates: all assertions passed");
} finally {
  cleanup();
}
