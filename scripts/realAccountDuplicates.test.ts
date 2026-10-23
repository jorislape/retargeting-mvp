/**
 * Real-account fix 3 — same-name rows are ONE creative.
 *
 * A real agency export ran the same ad name in 2–4 ad sets (29 names);
 * each row was ranked separately as "Name (row N)", splitting one
 * creative's evidence into thin fragments. Proves: exact-name rows are
 * merged (spend / outcomes / value / impressions summed, the KPI
 * recomputed from the sums — never an average of ratios); unknown parts
 * stay unknown; "- Copy" variants stay separate; no "(row N)" label
 * survives anywhere; "runs in N ad sets" only with an ad set column,
 * else "appears N times in this export", is
 * shown; breakdown exports are detected and named in the file card.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
const sku = (s: string) => (n: string) => n.includes(`[SKU]${s}_`);

const { run, requireCompiled, buildSampleMemo, cleanup } = loadEngine();
try {
  const { mergedRowsNote } = requireCompiled("modules/debrief/extract.js") as {
    mergedRowsNote: (m: { names: number; rows: number; breakdowns: string[]; adSetColumn?: boolean }) => string | null;
  };
  const r = run(AGENCY, "roas");

  /* ---- 3 spend rows (+1 zero-spend inactive row) → one creative ---- */
  const dup = r.ads.filter((a) => sku("00252")(a.name) && !/Copy$/.test(a.name));
  assert.equal(dup.length, 1, "one creative per exact name");
  assert.equal(dup[0].rowsMerged, 3, "zero-spend inactive row is not a delivery");
  assert.equal(dup[0].spend, 295);
  assert.equal(dup[0].conversions, 12);
  assert.ok(Math.abs((dup[0].kpiValue as number) - (140 * 3.4 + 95 * 3.1 + 60 * 2.8) / 295) < 1e-9, "Σvalue ÷ Σspend");
  assert.equal(dup[0].frequency, null, "reach doesn't add across ad sets");

  /* ---- "- Copy" / "– Copy" variants are NOT merged ---- */
  assert.equal(r.ads.filter((a) => sku("00252")(a.name)).length, 2, "the en-dash Copy stays its own creative");
  assert.equal(r.ads.filter((a) => sku("00240")(a.name)).length, 2, "the hyphen Copy stays its own creative");
  const merged240 = r.ads.find((a) => sku("00240")(a.name) && !/Copy$/.test(a.name))!;
  assert.equal(merged240.spend, 450);
  assert.equal(merged240.conversions, 30);

  /* ---- No row labels; no ad set column ⇒ "appears N times"; disclosure ---- */
  assert.ok(!JSON.stringify(r.memo).includes("(row "), "no (row N) in the memo");
  assert.ok(!r.buyerText.includes("(row ") && !r.clientText.includes("(row "));
  const row = [...r.memo.winners, ...r.memo.losers.rows].find((x) => sku("00240")(x.name) && !/Copy$/.test(x.name));
  assert.equal(row?.runsInLabel, "appears 2 times in this export");
  assert.match(r.buyerText, /\(appears 2 times in this export\) \|/);
  assert.ok(!JSON.stringify(r.memo).includes("ad sets"), "no ad set claim without an ad set column");
  assert.equal(r.analysis.duplicateAdNames.length, 2);
  assert.ok(
    r.memo.decision.limits.buyer.some((l) =>
      /^2 ad names appeared on several rows \(the same name appears more than once in this export\) and were combined into one creative each — spend, purchases and value summed, ROAS recomputed from the totals/.test(l)
    )
  );

  /* ---- Ratios recompute from sums for every KPI ---- */
  const two = (header: string, a: string, b: string) => `${header}\n${a}\n${b}\nOther,100,5,10,1000,20\n`;
  const H = "Ad name,Amount spent (EUR),Purchases,Link clicks,Impressions,Cost per purchase (EUR)";
  const cpa = run(two(H, "X,100,1,10,1000,100", "X,300,9,50,1000,33.33"), "cpa").ads.find((a) => a.name === "X")!;
  assert.equal(cpa.kpiValue, 40, "CPA = 400 ÷ 10, not the mean of 100 and 33.33");
  const ctr = run(two(H, "X,100,1,10,1000,100", "X,300,9,50,1000,33.33"), "ctr").ads.find((a) => a.name === "X")!;
  assert.equal(ctr.kpiValue, 3, "CTR = 60 ÷ 2,000");
  const cpc = run(two(H, "X,100,1,10,1000,100", "X,300,9,50,1000,33.33"), "cpc").ads.find((a) => a.name === "X")!;
  assert.ok(Math.abs((cpc.kpiValue as number) - 400 / 60) < 1e-9, "CPC = 400 ÷ 60");

  /* ---- An unknown part makes the aggregate unknown (missing ≠ 0) ---- */
  {
    const csv =
      "Ad name,Amount spent (EUR),Purchases,Purchase ROAS (return on ad spend)\n" +
      "Y,200,10,3\nY,200,5,\nZ,200,10,2\n";
    const y = run(csv, "roas").ads.find((a) => a.name === "Y")!;
    assert.equal(y.kpiValue, null, "one row's value unknown ⇒ the creative's ROAS unknown");
    assert.equal(y.conversions, 15);
  }

  /* ---- Breakdown export: detected and named ---- */
  {
    const csv =
      "Ad name,Day,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["A,2025-04-01,100,5,400", "A,2025-04-02,120,6,480", "A,2025-04-03,90,4,300", "B,2025-04-01,150,5,300", "B,2025-04-02,140,4,280"].join("\n") + "\n";
    const b = run(csv, "roas");
    assert.deepEqual(b.columns.breakdowns, ["Day"]);
    assert.deepEqual(b.analysis.mergedRows, { rows: 5, breakdowns: ["Day"], adSetColumn: false });
    const a = b.memo.winners.find((x) => x.name === "A") ?? b.memo.losers.rows.find((x) => x.name === "A");
    assert.equal(a?.runsInLabel, "appears 3 times in this export", "a breakdown repeats ads; it doesn't prove ad sets");
    assert.ok(b.memo.decision.limits.buyer.some((l) => l.includes("(the export is broken down by Day)")));
    assert.match(mergedRowsNote({ names: 2, rows: 5, breakdowns: ["Day"] })!, /^Broken down by Day: 5 rows share 2 ad names — combined into one creative per ad name/);
  }
  /* ---- An ad set column counts real ad sets ---- */
  {
    const csv =
      "Ad name,Ad set name,Age,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["A,Set 1,18-24,100,5,400", "A,Set 1,25-34,100,5,400", "A,Set 2,18-24,100,5,400", "B,Set 1,18-24,150,5,300"].join("\n") + "\n";
    const s = run(csv, "roas");
    const a = s.ads.find((x) => x.name === "A")!;
    assert.equal(a.adSetCount, 2);
    const aRow = [...s.memo.winners, ...s.memo.losers.rows, ...(s.memo.atMedian?.rows ?? [])].find((x) => x.name === "A");
    assert.equal(aRow?.runsInLabel, "runs in 2 ad sets", "the ad set column proves the ad sets");
    assert.equal(a.adSetName, null, "mixed ad sets ⇒ no single ad set");
    assert.equal(s.ads.find((x) => x.name === "B")!.adSetName, "Set 1", "single rows untouched");
  }

  /* ---- Clean files: nothing merges, nothing changes ---- */
  const clean = run(ECOM, "roas");
  assert.ok(clean.ads.every((a) => a.rowsMerged === undefined && a.adSetCount === undefined));
  assert.equal(clean.analysis.mergedRows, undefined);
  assert.equal(mergedRowsNote({ names: 0, rows: 0, breakdowns: [] }), null);
  assert.ok(!JSON.stringify(buildSampleMemo()).includes("runsInLabel"), "sample untouched");
  assert.match(
    mergedRowsNote({ names: 29, rows: 66, breakdowns: [] })!,
    /^66 rows share 29 ad names — each name is combined into one creative/
  );
  assert.match(
    mergedRowsNote({ names: 2, rows: 5, breakdowns: [], adSetColumn: true })!,
    /^5 rows share 2 ad names \(the same creative in several ad sets\)/
  );

  console.log("real-account duplicates: all assertions passed");
} finally {
  cleanup();
}
