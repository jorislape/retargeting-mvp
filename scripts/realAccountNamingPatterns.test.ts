/**
 * Real-account fix 8 — Patterns by naming (display-only).
 *
 * A real agency export encoded format/angle/hook/stage in "[KEY]VALUE"
 * name tokens, yet Patterns said "No clear ad-name pattern". Proves:
 * tokens are parsed ("- Copy" stripped, empty values dropped); the table
 * appears only when ≥50% of judged ads carry tokens; [FOR]/[AN]/[HK]/
 * [STG] come first; each row is spend / purchases / blended ROAS over
 * every ad with the value, and only values with ≥2× the minimum spend
 * are listed; "_" segments are a fallback only for a consistent ≥4-part
 * layout; the decision is byte-identical with or without the feature;
 * the client view never gets it; "No clear ad-name pattern" is replaced
 * when tokens exist.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";
import { parseNameTokens } from "../modules/debrief/namingPatterns.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");

/* ---- Token parsing ---- */
assert.deepEqual(parseNameTokens("[VAR]ORG_[FOR]UGC_[AN]QUAL_[STG]TOFU_[ED]STUDIO - Copy"), {
  VAR: "ORG", FOR: "UGC", AN: "QUAL", STG: "TOFU", ED: "STUDIO",
});
assert.deepEqual(parseNameTokens("[STG]_[FOR]IMG – Copy"), { FOR: "IMG" }, "empty value dropped, en-dash Copy stripped");
assert.deepEqual(parseNameTokens("UGC_MorningRoutine_V1"), {});

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  const r = run(AGENCY, "roas");
  const n = r.analysis.namingPatterns;
  assert.ok(n, "fixture: ≥50% of judged ads carry tokens");
  assert.equal(n!.basis, "tokens");
  assert.ok(n!.coverage.matched / n!.coverage.judged >= 0.5);
  assert.deepEqual(n!.keys.slice(0, 4).map((k) => k.key), ["FOR", "AN", "HK", "STG"], "preferred keys first");
  assert.ok(!n!.keys.some((k) => ["SKU", "DTE", "PLT", "AUD"].includes(k.key)), "ID-like and single-value keys skipped");

  /* Rows: independent recomputation for [FOR]UGC over EVERY analyzed ad. */
  const ugcAds = r.ads.filter((a) => parseNameTokens(a.name).FOR === "UGC");
  const ugc = n!.keys.find((k) => k.key === "FOR")!.rows.find((x) => x.value === "UGC")!;
  const spend = ugcAds.reduce((s, a) => s + a.spend, 0);
  assert.equal(ugc.ads, ugcAds.length);
  assert.ok(Math.abs(ugc.spend - spend) < 1e-9);
  assert.equal(ugc.outcomes, ugcAds.reduce((s, a) => s + (a.conversions ?? 0), 0));
  const valued = ugcAds.filter((a) => a.kpiValue != null);
  const blended = valued.reduce((s, a) => s + (a.kpiValue as number) * a.spend, 0) / valued.reduce((s, a) => s + a.spend, 0);
  assert.ok(Math.abs((ugc.kpiValue as number) - blended) < 1e-9, "blended = Σvalue ÷ Σspend");
  for (const k of n!.keys) {
    assert.ok(k.rows.length >= 2, `${k.key}: at least two comparable values`);
    for (const row of k.rows) assert.ok(row.spend >= 2 * r.analysis.spendGate, `${k.key}=${row.value}: ≥2× minimum spend`);
    const vals = k.rows.map((x) => x.kpiValue ?? -Infinity);
    assert.deepEqual(vals, [...vals].sort((a, b) => b - a), `${k.key}: best ROAS first`);
  }

  /* ---- Memo, TXT, copy replacements ---- */
  const np = r.memo.namingPatterns!;
  assert.match(np.intro, /^\d+ of \d+ judged ads use \[KEY\]VALUE name tokens\./);
  assert.equal(np.keys[0].key, "[FOR]");
  assert.match(r.buyerText, /\nPATTERNS BY NAMING\n/);
  assert.match(r.buyerText, /\n\[FOR\]:\n- \w+ \| \d+ ads \| [\d.,]+ EUR \| \d+ purchases \| [\d.]+x ROAS\n/);
  assert.ok(!r.clientText.includes("PATTERNS BY NAMING"), "client view never shows patterns");
  assert.ok(!r.memo.confidence.reasons.some((x) => x.startsWith("No clear ad-name pattern")));
  {
    // Tokens with no keyword tag in them (hasNameSignal false): the
    // "no pattern" / "metrics-only" lines are replaced, not just absent.
    const rows = ["[AN]QUAL_[HK]01,400,30,1800", "[AN]QUAL_[HK]02,400,28,1500", "[AN]EASE_[HK]01,400,20,800", "[AN]EASE_[HK]02,400,18,700", "[AN]FAST_[HK]01,400,22,1000", "[AN]FAST_[HK]02,400,21,950"];
    const t = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.join("\n") + "\n", "roas");
    assert.equal(t.analysis.hasNameSignal, false);
    assert.ok(t.analysis.namingPatterns);
    assert.ok(!t.memo.confidence.reasons.some((x) => x.startsWith("No clear ad-name pattern")), "replaced when tokens exist");
    assert.ok(t.memo.confidence.reasons.some((x) => x.startsWith("Ad names follow a naming convention")));
    assert.ok(t.memo.decision.limits.buyer.some((l) => l.startsWith("No creative notes, but the ad names follow a naming convention")));
    assert.ok(!t.memo.decision.limits.buyer.some((l) => l.includes("metrics-only read")));
    assert.ok(t.memo.patterns.winners[0].startsWith("Ad names follow a naming convention — see Patterns by naming"));
  }
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{memo\.namingPatterns && <NamingPatternsTable np=\{memo\.namingPatterns\} \/>\}/);
  assert.ok(report.indexOf("<NamingPatternsTable") > report.indexOf("{sections.patterns && !client && ("), "inside the buyer-only Patterns section");

  /* ---- Display-only: removing the tokens never changes the decision ---- */
  const untokened = AGENCY.replace(/\[([A-Z]{2,5})\]/g, "$1-");
  const u = run(untokened, "roas");
  assert.notEqual(u.analysis.namingPatterns?.basis, "tokens");
  assert.equal(JSON.stringify(u.memo.decision.budgetMove?.to.map((t) => t.spendLabel)), JSON.stringify(r.memo.decision.budgetMove?.to.map((t) => t.spendLabel)));
  assert.equal(u.memo.decision.action, r.memo.decision.action);
  assert.equal(u.analysis.median, r.analysis.median);

  /* ---- Below 50% of judged ads tokened ⇒ nothing ---- */
  {
    const rows = ["[FOR]UGC_[AN]A,400,20,1200", "Plain_B,400,20,1000", "Plain_C,400,20,900", "Plain_D,400,20,800", "Plain_E,400,20,700"];
    const t = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.join("\n") + "\n", "roas");
    assert.equal(t.analysis.namingPatterns, undefined);
  }
  /* ---- "_" fallback: only a consistent ≥4-part layout ---- */
  {
    const rows = ["UGC_Hook1_TOFU_LT,400,30,1800", "UGC_Hook2_BOFU_LT,400,28,1500", "IMG_Hook1_TOFU_LT,400,20,800", "IMG_Hook2_BOFU_LT,400,18,700", "VID_Hook1_TOFU_LT,400,22,1000"];
    const t = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.join("\n") + "\n", "roas");
    assert.equal(t.analysis.namingPatterns?.basis, "segments");
    assert.deepEqual(t.analysis.namingPatterns?.keys.map((k) => k.key), ["Part 1", "Part 2", "Part 3"], "single-value Part 4 skipped");
  }
  assert.equal(run(ECOM, "roas").analysis.namingPatterns, undefined, "3-part names are prose, not a layout");
  const sample = buildSampleMemo();
  assert.equal(sample.namingPatterns, undefined, "sample untouched");
  assert.ok(!memoToText(sample, "buyer", 5, []).includes("PATTERNS BY NAMING"));

  console.log("real-account naming patterns: all assertions passed");
} finally {
  cleanup();
}
