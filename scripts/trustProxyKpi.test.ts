/**
 * Trust Pass 4 — no budget moves on proxy KPIs when an outcome KPI exists.
 *
 * CTR/CPC rank attention/click cost and Purchases/Leads count volume;
 * none says what an ad returned. When the export ALSO carries ROAS or
 * CPA/CPL columns, a budget move on the proxy is withheld: the action
 * downgrades to "test" with "<KPI> ranks attention, not results —
 * switch to ROAS/CPA before moving budget" and a one-click switch.
 * Repro: the 13-ad ecom export on CTR used to shift budget from a 5.00x
 * ROAS ad into a 0.66x one. With no outcome column the move stands, but
 * a limits line names its proxy basis.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
/** The same export with only click-side columns (no ROAS/CPA/purchases). */
const CTR_ONLY = (() => {
  const rows = ECOM.trim().split("\n").map((l) => l.split(","));
  return rows.map((r) => r.slice(0, 5).join(",")).join("\n") + "\n";
})();
const BUDGET_TEST = /daily budget|budget-elasticity|Scale "/i;

const { run, cleanup } = loadEngine();
try {
  /* The repro: CTR no longer moves budget into the 0.66x-ROAS ad. */
  const ctr = run(ECOM, "ctr");
  const d = ctr.memo.decision;
  assert.equal(d.action, "test", "downgraded from budget");
  assert.equal(d.budgetMove, undefined, "no budget move from Hero_UGC_A (5.00x) into Clickbait_M (0.66x)");
  assert.deepEqual(d.kpiSwitch, { kpi: "roas", label: "ROAS" }, "one-click switch, ROAS preferred");
  assert.match(d.rationale, /^CTR ranks attention, not results — switch to ROAS\/CPA before moving budget\./);
  assert.match(d.headline, /No budget move on CTR — switch to ROAS\/CPA first\.$/);
  assert.ok(d.limits.buyer.some((l) => l.startsWith("CTR ranks attention, not results — budget moves are held")));
  assert.ok(d.limits.client.some((l) => l.startsWith("This report ranks ads by click-through rate")));
  assert.ok(!ctr.memo.nextTests.some((t) => BUDGET_TEST.test(t.test)), "no budget test slot either (shared scale rule)");
  assert.ok(!/KILL LIST/.test(ctr.buyerText), "no cut ⇒ no kill list");
  for (const s of [d.clientHeadline, d.clientRationale, ...d.avoidNow.client]) assert.ok(!/\b(median|CTR|benchmark)\b/.test(s), `client: ${s}`);

  /* Same rule for CPC and the count KPIs. */
  for (const kpi of ["cpc", "purchases"]) {
    const r = run(ECOM, kpi);
    assert.notEqual(r.memo.decision.action, "budget", `${kpi}: never a budget move with ROAS/CPA available`);
    assert.ok(r.analysis.proxyKpi && r.analysis.proxyKpi.outcomeKpis.length === 2);
  }
  const leadsCsv = "Ad name,Amount spent (USD),Leads,Cost per lead (USD)\n" +
    [["L1", 300, 60], ["L2", 310, 58], ["L3", 320, 8], ["L4", 330, 7], ["L5", 340, 6], ["L6", 350, 30], ["L7", 360, 5]]
      .map(([n, s, l]) => `${n},${s},${l},${((s as number) / (l as number)).toFixed(2)}`).join("\n") + "\n";
  const leads = run(leadsCsv, "leads");
  assert.notEqual(leads.memo.decision.action, "budget");
  assert.deepEqual(leads.analysis.proxyKpi?.outcomeKpis.map((o) => o.label), ["CPA (cost per lead)"]);
  assert.deepEqual(leads.memo.decision.kpiSwitch, { kpi: "cpa", label: "CPA (cost per lead)" }, "a real downgrade, switching to cost per lead");

  /* No outcome column: the move stands, with its proxy basis named. */
  const only = run(CTR_ONLY, "ctr");
  assert.deepEqual(only.analysis.proxyKpi?.outcomeKpis, []);
  assert.equal(only.memo.decision.action, "budget", "nothing better to read — today's behaviour");
  assert.equal(only.memo.decision.kpiSwitch, undefined);
  assert.ok(only.memo.decision.limits.buyer.some((l) => l.startsWith("This budget move is based on CTR, a proxy metric")));
  assert.ok(only.memo.decision.limits.client.some((l) => l.startsWith("This budget change is based on click-through rate")));

  /* Outcome KPIs are untouched. */
  assert.equal(run(ECOM, "roas").memo.decision.budgetVariant, "shift");
  assert.equal(run(ECOM, "roas").analysis.proxyKpi, undefined);
  assert.equal(run(ECOM, "cpa").analysis.proxyKpi, undefined);

  /* One-click switch wired on the card (generator only). */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /!client && d\.kpiSwitch && onSwitchKpi && \(/);
  assert.match(report, /onClick=\{\(\) => onSwitchKpi\(d\.kpiSwitch!\.kpi\)\}/);
  assert.match(readFileSync(join(ROOT, "app/(workspace)/generator/page.tsx"), "utf8"), /onSwitchKpi=\{\(kpi\) => void generate\(\{ kpi \}\)\}/);
  assert.match(readFileSync(join(ROOT, "components/workspace/DebriefProvider.tsx"), "utf8"), /const kpi = overrides\?\.kpi \?\? fields\.kpi;/);

  console.log("trustProxyKpi: all assertions passed");
} finally {
  cleanup();
}
