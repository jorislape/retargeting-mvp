/**
 * Trust Pass 2 — the real account result next to the median.
 *
 * accountKpi.ts computes the blended KPI from totals across every
 * analyzed ad; the buyer header shows "Account {KPI}" before "Median
 * {KPI}", the client view leads with it and calls the median "the
 * middle ad" (never "typical ROAS/CPA", never "median"). Sections read
 * "Above/Below median" without a target; with a target ROAS/CPA each
 * judged ad shows ✓/✗ vs target plus an "X of Y beat your target"
 * header line — display only, the action never changes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TESTER_CSV, loadEngine } from "./testerFeedbackEngine.ts";

const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
const CLIENT_BLOCK = [/\bmedian\b/i, /\btypical (ROAS|CPA|CPL|CTR|CPC|cost per lead|purchases|leads)\b/i, /\btypical result/i];
const close = (a: number | undefined, b: number, msg: string) => assert.ok(a != null && Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  /* ---- Blended math, per KPI type ---- */
  // ROAS = Σ value ÷ Σ spend; a 0-purchase ad adds spend and no value.
  const roas = run("Ad name,Amount spent (USD),Purchases,Purchases conversion value\nA,100,6,300\nB,200,4,200\nC,100,0,\n", "roas");
  close(roas.analysis.accountKpi?.value, 500 / 400, "ROAS");
  assert.equal(roas.memo.scope.accountKpiLabel, "1.25x");
  // CPA = Σ spend ÷ Σ purchases (zero-purchase ad included).
  const cpa = run("Ad name,Amount spent (USD),Purchases,Cost per purchase (USD)\nA,100,10,10\nB,200,5,40\nC,100,0,\n", "cpa");
  close(cpa.analysis.accountKpi?.value, 400 / 15, "CPA");
  // CPL (lead-based CPA) = Σ spend ÷ Σ leads.
  const cpl = run("Ad name,Amount spent (USD),Leads,Cost per lead (USD)\nA,100,20,5\nB,300,10,30\n", "cpa");
  close(cpl.analysis.accountKpi?.value, 400 / 30, "CPL");
  assert.equal(cpl.memo.scope.accountKpiBasis, "total spend ÷ total leads");
  // CTR = Σ clicks ÷ Σ impressions; CPC = Σ spend ÷ Σ clicks.
  const clicksCsv = "Ad name,Amount spent (USD),Impressions,Link clicks\nA,100,1000,20\nB,200,3000,30\n";
  close(run(clicksCsv, "ctr").analysis.accountKpi?.value, (50 / 4000) * 100, "CTR");
  close(run(clicksCsv, "cpc").analysis.accountKpi?.value, 300 / 50, "CPC");
  // Count KPI = Σ count.
  close(run("Ad name,Amount spent (USD),Purchases\nA,100,6\nB,200,4\n", "purchases").analysis.accountKpi?.value, 10, "Purchases");
  // Independent recomputation from the 13-ad fixture's own columns.
  const rows = ECOM.trim().split("\n").slice(1).map((l) => l.split(","));
  const ecom = run(ECOM, "roas");
  close(ecom.analysis.accountKpi?.value, rows.reduce((s, r) => s + Number(r[6]), 0) / rows.reduce((s, r) => s + Number(r[1]), 0), "ecom ROAS");
  assert.equal(ecom.memo.scope.accountKpiLabel, "2.20x");
  assert.equal(ecom.memo.scope.medianLabel, "2.50x");

  /* ---- Placement: Account before Median (buyer), headline (client) ---- */
  assert.match(ecom.buyerText, /Total spend: \$4,446\.00 · Account ROAS: 2\.20x · Median ROAS: 2\.50x/);
  assert.match(ecom.clientText, /Total spend: \$4,446\.00 · Account ROAS: 2\.20x · Middle ad's ROAS: 2\.50x/);
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  const iAcct = report.indexOf("[`Account ${viewKpiLabel}`, memo.scope.accountKpiLabel]");
  const iMed = report.indexOf("[`Median ${viewKpiLabel}`, memo.scope.medianLabel]");
  assert.ok(iAcct > 0 && iMed > iAcct, "buyer stat row: Account before Median");
  const cards = report.slice(report.indexOf("function ClientStatCards"), report.indexOf("function ClientDecisionSplit"));
  assert.ok(cards.indexOf("label: `Account ${scope.kpiLabelClient ?? scope.kpiLabel}`") < cards.indexOf('label: "Total spend"'), "client: Account KPI is the first card");
  assert.ok(!/Typical/.test(cards), "client cards never say Typical");

  /* ---- Client copy blocklist, every fixture × KPI + sample ---- */
  const sources: [string, string][] = [
    ["sample", memoToText(buildSampleMemo(), "client", 3, [])],
    ["ecom roas", ecom.clientText],
    ["ecom ctr", run(ECOM, "ctr").clientText],
    ["ecom cpa", run(ECOM, "cpa").clientText],
    ["tester cpa", run(TESTER_CSV, "cpa").clientText],
    ["ecom roas+target", run(ECOM, "roas", { targetRoas: 3 }).clientText],
  ];
  for (const [label, txt] of sources)
    for (const re of CLIENT_BLOCK) assert.ok(!re.test(txt), `${label}: client says ${txt.match(new RegExp(`[^\\n]{0,40}${re.source}[^\\n]{0,20}`, "i"))?.[0]}`);

  /* ---- Section names follow the target; no "kill list" label at all
     (Real-account fix 7) ---- */
  assert.match(ecom.buyerText, /\nABOVE MEDIAN\n/);
  assert.match(ecom.buyerText, /\nBELOW MEDIAN\n/, "shift: plain section name");
  assert.ok(!/KILL LIST/.test(ecom.buyerText));
  assert.match(ecom.clientText, /\nABOVE THE MIDDLE AD\n/);
  const tested = run(TESTER_CSV, "cpa");
  assert.equal(tested.memo.decision.action, "test");
  assert.match(tested.buyerText, /\nBELOW MEDIAN\n/, "no cut → no kill list");
  assert.ok(!/KILL LIST/.test(tested.buyerText));

  /* ---- Target: visible, display-only ---- */
  const tgt = run(ECOM, "roas", { targetRoas: 3 });
  assert.deepEqual(tgt.memo.scope.targetSummary, { targetLabel: "≥ 3.00x", beat: 5, judged: 13 });
  assert.match(tgt.buyerText, /Target ROAS ≥ 3\.00x: 5 of 13 judged ads beat your target\./);
  assert.match(tgt.clientText, /Your target \(ROAS ≥ 3\.00x\): 5 of 13 ads with enough spend to compare beat it\./);
  assert.match(tgt.buyerText, /- Hero_UGC_A \| 5\.00x · adj\. 3\.94x \(100% better than median\) \| ✓ beats target/);
  assert.match(tgt.buyerText, /- Unbox_F \| 2\.71x(?: · adj\. [\d.]+x)? \([^)]*\) \| ✗ misses target/);
  assert.match(tgt.buyerText, /\nWINNERS\n/, "with a target, the sections are winners/losers");
  assert.ok([...tgt.memo.winners, ...tgt.memo.losers.rows].every((r) => r.vsTarget != null));
  /* Bulletproof pass A1: the breakeven is now a business bar — it is
     listed as the user's criterion and replaces the "relative to the
     account" line; here every receiver beats it, so the call itself is
     identical. */
  const { appliedCriteria: tCrit, profitBasisNote: tNote, ...tRest } = tgt.memo.decision;
  const { appliedCriteria: eCrit, profitBasisNote: eNote, ...eRest } = ecom.memo.decision;
  assert.deepEqual(tRest, eRest, "every receiver beats a 3.00x breakeven ⇒ the same call");
  assert.deepEqual(tCrit.slice(0, eCrit.length), eCrit);
  assert.deepEqual(tCrit.slice(eCrit.length), [{ label: "Breakeven: 3.00x ROAS — an ad must beat it to receive budget — your criterion", source: "user" }]);
  assert.equal(tNote, undefined);
  assert.ok(eNote, "no breakeven ⇒ the move is stated as relative");
  // No target → no column / no summary.
  assert.equal(ecom.memo.scope.targetSummary, undefined);
  assert.ok([...ecom.memo.winners, ...ecom.memo.losers.rows].every((r) => r.vsTarget === undefined));
  assert.ok(!/beats target|misses target/.test(ecom.buyerText));
  assert.match(report, /const hasTarget = rows\.some\(\(r\) => r\.vsTarget != null\);/);
  assert.match(report, /\{hasTarget && \(\s*<th[^>]*>\s*vs target/);
  // Target CPA: ≤ target beats.
  const tc = run(TESTER_CSV, "cpa", { targetCpa: 19 });
  assert.equal(tc.memo.scope.targetSummary?.targetLabel, "≤ €19.00");
  assert.equal(tc.memo.scope.targetSummary?.beat, 3, "15.74, 17.65, 18.93 beat 19");

  console.log("trustAccountKpi: all assertions passed");
} finally {
  cleanup();
}
