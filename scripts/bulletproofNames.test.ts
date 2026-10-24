/**
 * Bulletproof pass B1 — collision-safe display names.
 *
 * Middle truncation made 86 different ads of a real export share a
 * displayed name at 60 characters (147 at 40, 234 at 28): agency names
 * differ only in a middle token ("[SKU]00147"). Proves, on names with the
 * real export's structure (the fixture's long tokened names, varied only
 * in [SKU]) and on the sample: plain truncation collides; the shortener
 * never does, at any cap the report uses, and keeps the distinguishing
 * token visible; the engine hands the report every analyzed ad name; no
 * report surface truncates names without the shared resolver.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";
import { NAME_DISPLAY_MAX, NAME_PRINT_MAX, buildNameShortener, disambiguateNames, middleTruncate } from "../components/debrief/longNames.ts";

const CAPS = [NAME_DISPLAY_MAX, 50, NAME_PRINT_MAX, 28];
const collisions = (names: string[], show: (n: string) => string) => {
  const by = new Map<string, Set<string>>();
  for (const n of names) by.set(show(n), (by.get(show(n)) ?? new Set()).add(n));
  return [...by.values()].filter((s) => s.size > 1).reduce((t, s) => t + s.size, 0);
};

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- Real-export structure: same head and tail, a different token in
     the hidden middle ([FN], like the real export's SKU / hook tokens) ---- */
  const agency = run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas");
  const base = agency.ads.map((a) => a.name).filter((n) => /\[FN\]\d+_/.test(n) && n.length > 100);
  assert.ok(base.length >= 10);
  const names = base.flatMap((n, i) => [0, 1, 2].map((k) => n.replace(/\[FN\]\d+_/, `[FN]${String(700 + i * 3 + k)}_`)));
  for (const cap of CAPS) assert.ok(collisions(names, (n) => middleTruncate(n, cap)) > 0, `plain truncation collides at ${cap} (the bug)`);
  for (const cap of CAPS) {
    const m = disambiguateNames(names, cap);
    assert.equal(collisions(names, (n) => m.get(n)!), 0, `no collision at ${cap}`);
    for (const n of names) {
      const token = n.match(/\[FN\]\d+_/)![0];
      assert.ok(m.get(n)!.includes(token.slice(0, -1)), `the distinguishing token stays visible: ${m.get(n)}`);
    }
  }
  /* Names that never collide keep the plain middle truncation. */
  const plain = disambiguateNames(["A_short", "x".repeat(100), "y".repeat(100)], 40);
  assert.equal(plain.get("x".repeat(100)), middleTruncate("x".repeat(100), 40));
  assert.equal(plain.get("A_short"), "A_short");
  const shorten = buildNameShortener(names);
  assert.equal(collisions(names, (n) => shorten(n, NAME_PRINT_MAX)), 0);

  /* ---- The engine hands the report every analyzed ad name ---- */
  assert.deepEqual([...agency.memo.scope.adNames!].sort(), agency.ads.map((a) => a.name).sort());
  const sample = buildSampleMemo();
  const sampleNames = sample.scope.adNames!;
  assert.equal(sampleNames.length, 14);
  for (const cap of CAPS) assert.equal(collisions(sampleNames, (n) => buildNameShortener(sampleNames)(n, cap)), 0, `sample @${cap}`);

  /* ---- Every report surface goes through the shared resolver ---- */
  for (const f of ["components/debrief/Report.tsx", "components/debrief/PerformanceRankingChart.tsx"]) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert.ok(!/middleTruncate\(/.test(src), `${f}: no raw middleTruncate — use useShortName()`);
  }
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /<NameDisplayContext\.Provider value=\{shortener\}>/);
  assert.match(report, /buildNameShortener\(\[\s*\.\.\.\(memo\.scope\.adNames \?\? \[\]\)/);

  console.log("bulletproof names: all assertions passed");
} finally {
  cleanup();
}
