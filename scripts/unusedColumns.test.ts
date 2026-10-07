/**
 * Unused Columns Disclosure — proofs.
 *
 * columns.ts's unusedColumns() lists the export headers resolveColumns
 * did not map to any ColumnMap field — excluding competing variants
 * already reported as "also found, not used", blank headers and
 * all-empty columns — capped at UNUSED_COLUMNS_CAP. The API returns it
 * BESIDE the memo (never inside it), the report shows it collapsed in
 * the buyer view only, and it never reaches the client view, PDF, TXT,
 * a log, or the sample memo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TESTER_CSV, loadEngine } from "./testerFeedbackEngine.ts";

type Unused = { headers: string[]; total: number };

const { run, requireCompiled, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  const { unusedColumns, UNUSED_COLUMNS_CAP } = requireCompiled("modules/debrief/columns.js") as {
    unusedColumns: (h: string[], c: unknown, r?: Record<string, string>[]) => Unused;
    UNUSED_COLUMNS_CAP: number;
  };
  const { parseCsv, toTable } = requireCompiled("modules/debrief/csv.js") as {
    parseCsv: (t: string) => string[][];
    toTable: (m: string[][]) => { headers: string[]; rows: Record<string, string>[] };
  };
  const unusedOf = (csv: string) => {
    const { headers, rows } = toTable(parseCsv(csv));
    const { columns } = run(csv, "cpa");
    return unusedColumns(headers, columns, rows);
  };

  /* Tester export: every column is mapped (Reach/Frequency included). */
  assert.deepEqual(unusedOf(TESTER_CSV), { headers: [], total: 0 });

  /* Extra fixture: campaign/ad-set names, landing page views and a video
     retention checkpoint are unused; a competing purchases variant is
     already disclosed elsewhere; blank and all-empty columns are noise. */
  const extra =
    "Ad name,Campaign name,Ad set name,Amount spent (EUR),Purchases,Website purchases,Cost per purchase (EUR),Landing page views,Video plays at 25%,,Notes\n" +
    "A1,Camp 1,Set 1,300,10,9,30,800,1200,,\n" +
    "A2,Camp 1,Set 2,280,8,8,35,700,1100,,\n" +
    "A3,Camp 2,Set 3,260,6,6,43.33,650,900,,\n";
  const e = unusedOf(extra);
  // Campaign / ad set names are read since Mixed Segment Warning — no longer unused.
  assert.deepEqual(e, { headers: ["Landing page views", "Video plays at 25%"], total: 2 });
  const ex = run(extra, "cpa");
  assert.ok(ex.columns.sources && JSON.stringify(ex.columns.sources).includes('"ignored":["Purchases"]'),
    "the competing variant is the one reported as 'also found, not used' — so it isn't listed twice");
  assert.equal(ex.columns.videoPlays, null, "a retention checkpoint is never cited as a hook-level metric");
  assert.ok(!/Video plays at 25%/.test(ex.buyerText), "and the memo never cites it");

  /* Cap: 50 extra columns → 40 listed, true total kept. */
  const many = Array.from({ length: 50 }, (_, i) => `Extra ${i}`);
  const wide = `Ad name,Amount spent (EUR),Purchases,${many.join(",")}\nA,100,2,${many.map(() => "1").join(",")}\n`;
  const w = unusedOf(wide);
  assert.equal(UNUSED_COLUMNS_CAP, 40);
  assert.equal(w.total, 50);
  assert.deepEqual(w.headers, many.slice(0, 40));

  /* Sample: the memo has no such field and is untouched; every column of
     its own export is read (campaign/ad set names included). */
  const s = buildSampleMemo();
  assert.ok(!("unusedColumns" in s));
  assert.ok(!/didn't use/.test(memoToText(s, "buyer", 5, [])));

  /* API: returned beside the memo, never inside it, never logged. */
  const route = readFileSync(join(ROOT, "app/api/debrief/route.ts"), "utf8");
  assert.match(route, /return ok\(\{ ok: true, memo, unusedColumns: unusedColumns\(headers, columns, rows\) \}\)/);
  for (const m of route.matchAll(/console\.\w+\([\s\S]*?\);/g))
    assert.ok(!/unusedColumns|headers/.test(m[0]), `a log statement references headers: ${m[0].slice(0, 80)}`);
  const types = readFileSync(join(ROOT, "modules/debrief/types.ts"), "utf8");
  assert.ok(!/unusedColumns/.test(types), "not part of the Memo type (so never in a queue snapshot)");

  /* Report: buyer-only, collapsed, print-hidden; exact copy. TXT never. */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{!client && unusedColumns && unusedColumns\.total > 0 && \(\s*<details className="print-hidden/);
  assert.match(report, /Columns in your export Debrief didn&apos;t use \(\{unusedColumns\.total\}\)/);
  assert.match(report, /They don&apos;t affect this read\. Tell us if one of them matters for your decisions\./);
  const text = readFileSync(join(ROOT, "components/debrief/memoToText.ts"), "utf8");
  assert.ok(!/unusedColumns|didn't use/.test(text), "Copy/TXT never include it");
  const gen = readFileSync(join(ROOT, "app/(workspace)/generator/page.tsx"), "utf8");
  assert.match(gen, /unusedColumns=\{unusedColumns\}/);
  for (const f of ["app/(workspace)/sample/page.tsx", "app/(workspace)/decision-queue/[id]/page.tsx"])
    assert.ok(!/unusedColumns/.test(readFileSync(join(ROOT, f), "utf8")), `${f} passes none`);

  console.log("unusedColumns: all assertions passed");
} finally {
  cleanup();
}
