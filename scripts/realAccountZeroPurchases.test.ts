/**
 * Real-account fix 1 — zero-purchase ads in ROAS mode.
 *
 * A real agency export left ROAS AND Purchases blank on every ad with
 * spend but no purchases (Meta writes blank, not 0, for "no actions"),
 * so 230 ads were set aside as "no ROAS value" and the account ROAS was
 * read "from 111 of 341 ads". Proves: such a row is a 0x result — judged
 * as the worst at ≥ ZERO_CONVERSION_SPEND_MULTIPLE × the account's cost
 * per purchase, set aside below it as "no purchases yet, low spend" and
 * named; "no ROAS value" stays only for rows with genuinely missing data
 * (purchases but no value; no ROAS/value data in the file at all); the
 * account ROAS is total value ÷ total spend over every ad.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const bySku = (sku: string) => (n: string) => n.includes(`[SKU]${sku}_`);

const { run, buildSampleMemo, requireCompiled, cleanup } = loadEngine();
try {
  const { parseCsv, toTable } = requireCompiled("modules/debrief/csv.js") as {
    parseCsv: (t: string) => string[][];
    toTable: (m: string[][]) => { rows: Record<string, string>[] };
  };
  const { ZERO_CONVERSION_SPEND_MULTIPLE } = requireCompiled("modules/debrief/analysis.js") as {
    ZERO_CONVERSION_SPEND_MULTIPLE: number;
  };
  const num = (v: string | undefined) => (v == null || v.trim() === "" ? null : Number(v));
  const { rows } = toTable(parseCsv(AGENCY));
  const spent = rows.filter((r) => (num(r["Amount spent (EUR)"]) ?? 0) > 0);
  const totalSpend = spent.reduce((s, r) => s + (num(r["Amount spent (EUR)"]) as number), 0);
  const totalPurchases = spent.reduce((s, r) => s + (num(r["Purchases"]) ?? 0), 0);
  const totalValue = spent.reduce(
    (s, r) => s + (num(r["Purchase ROAS (return on ad spend)"]) ?? 0) * (num(r["Amount spent (EUR)"]) as number),
    0
  );

  const r = run(AGENCY, "roas");
  const a = r.analysis;

  /* ---- Blank ROAS + blank purchases, real spend → 0x, judged worst ---- */
  const judgedZero = r.ads.find((x) => bySku("00280")(x.name));
  assert.equal(judgedZero?.zeroConversions, true);
  assert.equal(judgedZero?.kpiValue, 0, "ROAS is 0x, not missing");
  assert.equal(judgedZero?.conversions, 0);
  const bar = ZERO_CONVERSION_SPEND_MULTIPLE * (totalSpend / totalPurchases);
  assert.ok(250 >= bar, "fixture: the 250 EUR zero ad clears the bar");
  assert.ok(bySku("00280")(a.losers[0].name), "ranked as the worst judged ad");
  assert.ok(!a.rankedAds.some((x) => x.zeroConversions && x.deltaFromMedian === 0));
  assert.ok(a.median != null && a.median > 0, "0x ads stay out of the median");

  /* ---- Under the bar → "no purchases yet, low spend", named ---- */
  const thin = a.zeroOutcomeThin;
  assert.ok(thin, "zero ads under the bar are set aside");
  assert.equal(thin!.needs, bar, "bar = 2 × total spend ÷ total purchases");
  assert.equal(thin!.unitCost, totalSpend / totalPurchases);
  assert.ok(thin!.ads.some((x) => bySku("00282")(x.name)), "explicit 0 purchases counts too");
  assert.ok(thin!.ads.some((x) => bySku("00291")(x.name)), "blank purchases counts too");
  /* Past the zero bar but under the spend gate: the gate applies first. */
  assert.ok(45 >= bar && 45 < a.spendGate);
  assert.ok(!thin!.ads.some((x) => bySku("00281")(x.name)), "under the spend gate ⇒ too little spend");
  assert.equal(a.kpiGaps?.zeroLowSpend, thin!.ads.length);
  const zeroLine = r.memo.decision.limits.buyer.find((l) => l.includes("no purchases yet, low spend"));
  assert.ok(zeroLine, "one named set-aside line");
  assert.match(zeroLine!, new RegExp(`^${thin!.ads.length} ads with 0 purchases set aside`));
  assert.match(zeroLine!, /and \d+ more; each needs ≥ [\d.,]+ EUR — 2× the account's [\d.,]+ EUR cost per purchase/);
  assert.ok(!r.memo.decision.limits.buyer.some((l) => /had no purchases, so ROAS couldn't be computed/.test(l)));
  /* Real-account review: past 3 ads the client line is a count only —
     a client report never lists hundreds of names (the buyer keeps them). */
  assert.ok(thin!.ads.length > 3, "fixture: more than the named few");
  assert.ok(
    r.memo.decision.limits.client.includes(`${thin!.ads.length} ads haven't made a purchase yet but also haven't spent enough to call.`),
    "client: count only"
  );
  assert.ok(!r.memo.decision.limits.client.some((l) => thin!.ads.some((x) => l.includes(x.name))), "no zero-ad names in the client register");
  {
    const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
    assert.match(report, /const CLIENT_APPENDIX_NAME_MAX = 40;/);
    assert.match(report, /<Names text=\{client \? clipQuotedNames\(line, shorten\) : line\} \/>/, "client appendix names clipped to 40 (collision-safe)");
  }

  /* ---- The "Set aside" tooltip names them too ---- */
  assert.deepEqual(r.memo.scope.zeroOutcomeAside, { count: thin!.ads.length, many: "purchases" });
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /memo\.scope\.zeroOutcomeAside \? `, or no \$\{memo\.scope\.zeroOutcomeAside\.many\} yet on low spend` : ""/);
  assert.equal(run(readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8"), "roas").memo.scope.zeroOutcomeAside, undefined, "absent without such ads");

  /* ---- "no ROAS value" only for genuinely missing data ---- */
  assert.equal(a.kpiGaps?.noValue, 1, "only the purchases-but-no-value row");
  assert.equal(r.ads.find((x) => bySku("00299")(x.name))?.kpiValue, null);
  assert.equal(r.ads.find((x) => bySku("00299")(x.name))?.zeroConversions, undefined);

  /* ---- Account ROAS = total value ÷ total spend over ALL ads (0x ads
     included; the one row whose value is unknown is left out of both
     sides and disclosed via coverage, never counted as 0) ---- */
  const unknownSpend = spent
    .filter((r) => (num(r["Purchases"]) ?? 0) > 0 && num(r["Purchase ROAS (return on ad spend)"]) == null)
    .reduce((s, r) => s + (num(r["Amount spent (EUR)"]) as number), 0);
  assert.ok(a.accountKpi);
  assert.ok(Math.abs(a.accountKpi!.value - totalValue / (totalSpend - unknownSpend)) < 1e-9);
  assert.equal(a.accountKpi!.adsTotal, a.adsAnalyzed);
  assert.equal(a.accountKpi!.adsCovered, a.adsAnalyzed - 1, "only the no-value row is uncovered");

  /* ---- No ROAS data in the file → no zero is inferred ---- */
  {
    const noValueCols =
      "Ad name,Amount spent (EUR),Purchases,Purchase ROAS (return on ad spend)\n" +
      "N1,300,5,\nN2,300,0,\nN3,300,,\n";
    const t = run(noValueCols, "roas");
    assert.ok(t.ads.every((x) => x.zeroConversions === undefined), "ROAS column blank everywhere ⇒ missing, not 0");
  }
  /* ---- Purchases column absent: a blank ROAS proves nothing ---- */
  {
    const noCount =
      "Ad name,Amount spent (EUR),Purchase ROAS (return on ad spend)\n" + "P1,300,2.1\nP2,300,3.4\nP3,300,\n";
    const t = run(noCount, "roas");
    assert.equal(t.ads.find((x) => x.name === "P3")?.zeroConversions, undefined);
    assert.equal(t.analysis.kpiGaps?.noValue, 1);
  }
  /* ---- CPA keeps its own rule: a blank count is still missing ---- */
  {
    const cpa = run(AGENCY, "cpa");
    assert.ok(!cpa.ads.some((x) => x.zeroConversions && x.conversions == null));
  }

  /* ---- Client register stays jargon-free ---- */
  for (const s of clientStrings(r.memo))
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* ---- Sample (intended change): its one zero-purchase ad is named ---- */
  const sample = buildSampleMemo();
  assert.equal(sample.scope.adsJudged, 11);
  assert.equal(sample.scope.adsSetAside, 3);
  assert.ok(sample.decision.limits.buyer.some((l) => l.startsWith("1 ad with 0 purchases set aside — no purchases yet, low spend")));
  assert.ok(sample.decision.limits.client.some((l) => l.includes('"Video_Hook_FastCut_V4"')), "≤3 ads: the client line still names them");

  console.log("real-account zero purchases: all assertions passed");
} finally {
  cleanup();
}
