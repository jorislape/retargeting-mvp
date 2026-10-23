/**
 * Real-account fix 8 — Patterns by naming (display-only).
 *
 * A real agency export encoded format/angle/hook/stage in "[KEY]VALUE"
 * name tokens, yet Patterns said "No clear ad-name pattern". Proves:
 * tokens are parsed ("- Copy" stripped, empty values dropped); the table
 * appears when ≥50% of ALL ads OR ads holding ≥30% of judged spend carry
 * tokens, with a "Covers X% of judged spend" line, and then turns the
 * Buyer view's Patterns section on by default; [FOR]/[AN]/[HK]/
 * [STG] come first; each row is spend / purchases / blended ROAS over
 * every ad with the value, and only values with ≥2× the minimum spend
 * and ≥2 ads are listed (numeric values normalized: 01 == 1); "_" segments are a fallback only for a consistent ≥4-part
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
assert.deepEqual(parseNameTokens("[HK]01_[CR]1_[AN]QUAL"), { HK: "1", CR: "1", AN: "QUAL" }, "01 == 1, shown unpadded");
assert.deepEqual(parseNameTokens("[HK]007"), { HK: "7" });

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  const r = run(AGENCY, "roas");
  const n = r.analysis.namingPatterns;
  assert.ok(n, "fixture: ≥50% of judged ads carry tokens");
  assert.equal(n!.basis, "tokens");
  assert.equal(n!.coverage.total, r.analysis.adsAnalyzed, "token share is over all ads");
  const judgedSpend = r.analysis.rankedAds.reduce((s, a) => s + a.spend, 0);
  const tokSpend = r.analysis.rankedAds.filter((a) => Object.keys(parseNameTokens(a.name)).length > 0).reduce((s, a) => s + a.spend, 0);
  assert.ok(Math.abs(n!.coverage.judgedSpendShare - tokSpend / judgedSpend) < 1e-9);
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
    for (const row of k.rows) {
      assert.ok(row.spend >= 2 * r.analysis.spendGate, `${k.key}=${row.value}: ≥2× minimum spend`);
      assert.ok(row.ads >= 2, `${k.key}=${row.value}: on at least 2 ads`);
      assert.ok(!/^0\d/.test(row.value), `${k.key}=${row.value}: numeric values unpadded`);
    }
    assert.equal(new Set(k.rows.map((x) => x.value)).size, k.rows.length, `${k.key}: one row per value`);
    const vals = k.rows.map((x) => x.kpiValue ?? -Infinity);
    assert.deepEqual(vals, [...vals].sort((a, b) => b - a), `${k.key}: best ROAS first`);
  }

  /* ---- Memo, TXT, copy replacements ---- */
  const np = r.memo.namingPatterns!;
  assert.match(np.intro, /^\d+ of \d+ ads use \[KEY\]VALUE name tokens\./);
  assert.equal(np.coverageLine, `Covers ${Math.round((tokSpend / judgedSpend) * 100)}% of judged spend.`);
  assert.ok(r.buyerText.includes(`\n${np.coverageLine}\n`), "coverage line in TXT");
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

  /* ---- Under 50% of ads AND under 30% of judged spend ⇒ nothing ---- */
  {
    const rows = ["[FOR]UGC_[AN]A,400,20,1200", "Plain_B,400,20,1000", "Plain_C,400,20,900", "Plain_D,400,20,800", "Plain_E,400,20,700"];
    const t = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.join("\n") + "\n", "roas");
    assert.equal(t.analysis.namingPatterns, undefined, "1/5 ads, 20% of judged spend");
  }
  /* ---- Under 50% of ads but ≥30% of judged spend ⇒ shown ---- */
  {
    const rows = [
      "[FOR]UGC_[AN]QUAL,600,30,2700", "[FOR]UGC_[AN]EASE,600,28,2400",
      "[FOR]IMG_[AN]QUAL,600,25,1900", "[FOR]IMG_[AN]EASE,600,22,1600",
      "Plain_B,300,15,900", "Plain_C,300,15,800", "Plain_D,300,15,700", "Plain_E,300,15,650", "Plain_F,300,14,600",
    ];
    const t = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.join("\n") + "\n", "roas");
    const tn = t.analysis.namingPatterns;
    assert.ok(tn, "4/9 ads tokened but 62% of judged spend");
    assert.equal(tn!.coverage.matched, 4);
    assert.equal(t.memo.namingPatterns!.coverageLine, "Covers 62% of judged spend.");
  }
  /* ---- A value on a single ad is hidden; a key left with <2 values goes ---- */
  {
    const rows = [
      "[FOR]UGC_[HK]01,600,30,2700", "[FOR]UGC_[HK]1,600,28,2400", "[FOR]IMG_[HK]02,600,25,1900",
      "[FOR]IMG_[HK]2,600,22,1600", "[FOR]VID_[HK]03,600,20,1200",
    ];
    const t = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.join("\n") + "\n", "roas");
    const keys = Object.fromEntries(t.analysis.namingPatterns!.keys.map((k) => [k.key, k.rows.map((x) => `${x.value}:${x.ads}`)]));
    assert.deepEqual(keys.FOR, ["UGC:2", "IMG:2"], "VID (1 ad) hidden");
    assert.deepEqual(keys.HK, ["1:2", "2:2"], "01 + 1 and 02 + 2 merged; 03 (1 ad) hidden");
  }
  /* ---- "_" fallback: only a consistent ≥4-part layout ---- */
  {
    const rows = ["UGC_Hook1_TOFU_LT,400,30,1800", "UGC_Hook2_BOFU_LT,400,28,1500", "IMG_Hook1_TOFU_LT,400,20,800", "IMG_Hook2_BOFU_LT,400,18,700", "VID_Hook1_TOFU_LT,400,22,1000"];
    const t = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.join("\n") + "\n", "roas");
    assert.equal(t.analysis.namingPatterns?.basis, "segments");
    assert.deepEqual(t.analysis.namingPatterns?.keys.map((k) => k.key), ["Part 1", "Part 2", "Part 3"], "single-value Part 4 skipped");
  }
  assert.equal(run(ECOM, "roas").analysis.namingPatterns, undefined, "3-part names are prose, not a layout");
  /* ---- Buyer Patterns default: on with naming patterns, unchanged otherwise ---- */
  const presetsSrc = readFileSync(join(ROOT, "components/debrief/reportPresets.ts"), "utf8");
  assert.match(presetsSrc, /if \(!hasNamingPatterns\) return PERFORMANCE_MODE_DEFAULTS;/, "no tokens ⇒ the exact existing defaults");
  assert.match(presetsSrc, /internal: \{ \.\.\.internal, sections: \{ \.\.\.internal\.sections, patterns: true \} \}/);
  assert.match(report, /useState\(\(\) => performanceModeDefaultsFor\(memo\.namingPatterns != null\)\)/);
  assert.match(report, /useReportCustomization\(\s*PERFORMANCE_SECTION_IDS,\s*PERFORMANCE_PRESETS,\s*modeDefaults\s*\)/);
  assert.match(report, /\{np\.coverageLine\}/);

  const sample = buildSampleMemo();
  assert.equal(sample.namingPatterns, undefined, "sample untouched");
  assert.ok(!memoToText(sample, "buyer", 5, []).includes("PATTERNS BY NAMING"));

  console.log("real-account naming patterns: all assertions passed");
} finally {
  cleanup();
}
