/**
 * Real-account review — the executive summary and the Next move name the
 * same budget targets.
 *
 * On a real export the print summary's "Verdict" called the passed-over
 * leader "the clear winner … move budget toward it" while the Next move
 * shifted budget into three OTHER ads. Proves, across every fixture and
 * the sample: whenever the decision moves budget into ads, every ad the
 * verdict (buyer and client) names as a target is one of the decision's
 * receivers, the passed-over leader is never named there, and a verdict
 * without a scale side never says "move budget".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const fixture = (f: string) => readFileSync(join(ROOT, "scripts/fixtures", f), "utf8");
const quoted = (s: string) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  type Memo = ReturnType<typeof buildSampleMemo>;
  const cases: [string, Memo, string | null][] = [];
  const add = (label: string, r: ReturnType<typeof run>) => {
    const top = r.analysis.winners[0]?.name ?? null;
    const to = r.memo.decision.budgetMove?.to.map((t) => t.name) ?? [];
    cases.push([label, r.memo, top != null && to.length > 0 && !to.includes(top) ? top : null]);
  };
  add("agency", run(fixture("agency-naming-convention.csv"), "roas"));
  add("ecom", run(fixture("ecom-13ads.csv"), "roas"));
  add("tester cpa", run(fixture("tester-cpa-8ads.csv"), "cpa"));
  // One receiver; the thin leader (6 purchases) is passed over.
  add("single receiver", run(H + ["Thin_Leader,250,6,2000", "Solid_A,400,30,2400", "Mid_B,400,20,1100", "Mid_C,400,19,1050", "Mid_G,400,18,1000", "Low_D,400,12,800", "Low_E,400,10,700", "Low_F,400,9,600"].join("\n") + "\n", "roas"));
  cases.push(["sample", buildSampleMemo(), null]);

  assert.ok(cases.some(([, , passed]) => passed != null), "at least one case passes over the raw leader");
  assert.ok(cases.some(([, m]) => (m.decision.budgetMove?.to.length ?? 0) === 1), "a single-receiver case");
  for (const [label, memo, passedOver] of cases) {
    const d = memo.decision;
    const to = d.budgetMove?.to.map((t) => t.name) ?? [];
    for (const line of [memo.tldr[0], memo.clientSummary[0]]) {
      if (to.length > 0) {
        for (const name of quoted(line)) assert.ok(to.includes(name), `${label}: verdict names "${name}", not a receiver`);
        assert.ok(quoted(line).length > 0, `${label}: the verdict names the primary receiver`);
        assert.equal(quoted(line)[0], to[0], `${label}: led by the card's primary receiver`);
      } else {
        assert.ok(!/move budget toward|earns? a larger share/i.test(line), `${label}: no budget target without a move`);
      }
    }
    if (passedOver != null) {
      for (const line of [...memo.tldr, ...memo.clientSummary]) assert.ok(!line.includes(passedOver), `${label}: the passed-over leader is not a target`);
    }
  }

  /* The print summary reads its Verdict straight from these lines. */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{ label: "Verdict", value: \(client \? memo\.clientSummary : memo\.tldr\)\[0\] \}/);

  console.log("real-account summary: all assertions passed");
} finally {
  cleanup();
}
