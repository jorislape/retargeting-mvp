/**
 * Attribution & Intent 1 — recognise attribution-split columns.
 *
 * columns.ts parseAttributionHeader() reads click-only and view-through
 * variants of purchases, purchase value and leads (incl. Website /
 * On-Facebook / Results bases), 1- and 7-day click, in both "(…)" and
 * "[…]" suffix styles, with or without "attribution". Split headers are
 * never the blended column, never its "also found, not used"
 * competitor, and leave the unused-columns list; the KPI source
 * disclosure names them. No split columns ⇒ output identical to before.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const SPLIT = readFileSync(join(ROOT, "scripts/fixtures/attribution-split.csv"), "utf8");
const BRACKETS = SPLIT.replace(/\((7-day click|1-day click|1-day view)\)/g, "[$1]");

type Parsed = { field: string; window: string } | null;
const { run, requireCompiled, cleanup } = loadEngine();
try {
  const cols = requireCompiled("modules/debrief/columns.js") as {
    parseAttributionHeader: (h: string) => Parsed;
    isAttributionSplitHeader: (h: string) => boolean;
    resolveColumns: (h: string[]) => { purchases: string | null; purchaseValue: string | null; costPerPurchase: string | null; sources: Record<string, { ignored: string[] }>; attributionSplits: Record<string, Record<string, string>> };
    unusedColumns: (h: string[], c: unknown) => { headers: string[] };
    kpiSourcePreview: (k: string, c: unknown) => string | null;
  };
  const p = (h: string) => {
    const r = cols.parseAttributionHeader(h);
    return r ? `${r.field}/${r.window}` : null;
  };

  /* ---- Supported patterns (both formats, case-insensitive) ---- */
  const cases: [string, string | null][] = [
    ["Purchases (7-day click)", "purchases/click7"],
    ["Purchases [7-day click]", "purchases/click7"],
    ["purchases [1 day view]", "purchases/view"],
    ["PURCHASES (1-DAY CLICK)", "purchases/click1"],
    ["Website purchases (7-day click attribution)", "purchases/click7"],
    ["Purchases [Attribution setting: 1-day view]", "purchases/view"],
    ["On-Facebook purchases [7 days click]", "purchases/click7"],
    ["Results (7-day click)", "purchases/click7"],
    ["Purchases conversion value (7-day click) (USD)", "purchaseValue/click7"],
    ["Website purchases conversion value [1-day view]", "purchaseValue/view"],
    ["Leads (1-day click)", "leads/click1"],
    ["Website leads [7-day view]", "leads/view"],
    ["Purchases (1-day engaged-view)", "purchases/view"],
    // Not splits Debrief reads (but still kept out of blended resolution):
    ["Cost per purchase (7-day click)", null],
    ["Purchase ROAS [1-day view]", null],
    // Ordinary headers:
    ["Purchases", null],
    ["Amount spent (USD)", null],
    ["Purchases conversion value (USD)", null],
  ];
  for (const [h, want] of cases) assert.equal(p(h), want, h);
  assert.ok(cols.isAttributionSplitHeader("Cost per purchase (7-day click)"));
  assert.ok(!cols.isAttributionSplitHeader("Amount spent (USD)"));

  /* ---- Never the blended column, never a competitor, never "unused" ---- */
  const headers = [
    "Ad name", "Amount spent (USD)", "Purchases", "Purchases (7-day click)", "Purchases [1-day view]",
    "Purchases conversion value", "Purchases conversion value (7-day click)", "Cost per purchase", "Cost per purchase (7-day click)",
  ];
  const c = cols.resolveColumns(headers);
  assert.equal(c.purchases, "Purchases");
  assert.equal(c.purchaseValue, "Purchases conversion value");
  assert.equal(c.costPerPurchase, "Cost per purchase");
  for (const src of Object.values(c.sources)) assert.ok(!src.ignored.some((h) => cols.isAttributionSplitHeader(h)), "split never listed as a competing variant");
  assert.deepEqual(c.attributionSplits.purchases, { click7: "Purchases (7-day click)", view: "Purchases [1-day view]" });
  const unused = cols.unusedColumns(headers, c).headers;
  assert.ok(!unused.includes("Purchases (7-day click)") && !unused.includes("Purchases [1-day view]"), "read splits leave the unused list");
  assert.deepEqual(unused, ["Cost per purchase (7-day click)"], "an unread split stays honestly listed");

  /* ---- Disclosure: preview + report ---- */
  const preview = cols.kpiSourcePreview("roas", cols.resolveColumns(SPLIT.split("\n")[0].split(",")));
  // Item 2: with a click-only value column the preview states the basis.
  assert.equal(preview, "Ranked on 7-day click only (view-through excluded): 'Purchases conversion value (7-day click)' and 'Purchases (7-day click)'.");
  // A view-only split is still just disclosed.
  const viewOnly = cols.kpiSourcePreview("roas", cols.resolveColumns(["Ad name", "Amount spent (USD)", "Purchases conversion value", "Purchases conversion value [1-day view]"]));
  assert.match(viewOnly ?? "", /attribution split found: 'Purchases conversion value \[1-day view\]'/);
  for (const csv of [SPLIT, BRACKETS]) {
    const r = run(csv, "roas");
    assert.equal(r.analysis.attributionColumns?.length, 6, "all six split columns detected, both formats");
  }

  /* ---- No split columns ⇒ no split wording; Bulletproof pass A7 adds
     ONE line naming the window the numbers use (outcome KPIs only). ---- */
  for (const f of ["ecom-13ads", "tester-cpa-8ads", "regional-semicolon"]) {
    const csv = readFileSync(join(ROOT, "scripts/fixtures", `${f}.csv`), "utf8");
    for (const kpi of ["roas", "cpa", "ctr"]) {
      let r;
      try { r = run(csv, kpi); } catch { continue; }
      assert.equal(r.analysis.attributionColumns, undefined, `${f}/${kpi}`);
      const DEFAULT_LINE = /^Results use the account's attribution setting at export time \(Meta default: 7-day click, 1-day engage-through, 1-day view\); a different window changes (ROAS|CPA|cost per lead)\.$/;
      const mentions = r.memo.decision.limits.buyer.filter((l) => /attribution/i.test(l));
      if (kpi === "ctr") assert.equal(mentions.length, 0, `${f}/${kpi}: CTR isn't attributed — no line`);
      else assert.ok(mentions.length === 1 && DEFAULT_LINE.test(mentions[0]), `${f}/${kpi}: the default-window line only`);
      assert.ok(!/view-through excluded|splits conversions by attribution window/.test(JSON.stringify(r.memo)), `${f}/${kpi}: no split wording`);
    }
  }

  /* ---- Bulletproof pass A7: Meta's "Attribution setting" column ---- */
  {
    const rows = (setting: (i: number) => string) =>
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value,Attribution setting\n" +
      ["A,400,30,1600", "B,400,20,1200", "C,400,20,1220", "D,400,20,1180", "E,400,20,1150", "F,400,20,1100", "G,0,0,0"]
        .map((r, i) => `${r},"${setting(i)}"`).join("\n") + "\n";
    const mixed = run(rows((i) => (i < 4 ? "7-day click or 1-day view" : "7-day click, 1-day view or 1-day engaged view")), "roas");
    assert.deepEqual(mixed.analysis.attributionSettings, [
      { value: "7-day click or 1-day view", rows: 4 },
      { value: "7-day click, 1-day view or 1-day engaged view", rows: 2 },
    ], "rows with spend only");
    assert.ok(mixed.memo.decision.limits.buyer.includes(
      // Bulletproof pass C1: the settings differ only in engaged view (video-only); these names show no format.
      'The export\'s attribution settings differ only in engaged view ("7-day click or 1-day view" (4 rows) and "7-day click, 1-day view or 1-day engaged view" (2 rows)), which Meta counts for video ads only — among video/UGC ads (or ads with no format in the name) the windows differ ("7-day click or 1-day view" on 4 ads and "7-day click, 1-day view or 1-day engaged view" on 2 ads), so their ROAS isn\'t strictly comparable.'
    ));
    const single = run(rows(() => "7-day click or 1-day view"), "roas");
    assert.ok(single.memo.decision.limits.buyer.includes('Results use the export\'s attribution setting ("7-day click or 1-day view"); a different window changes ROAS.'));
    for (const s of single.memo.decision.limits.client) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
  }

  /* ---- A-fix 2: mixed windows are a comparability finding ---- */
  {
    const W = "7-day click, 1-day view or 1-day engaged view";
    const N = "7-day click or 1-day view";
    // Receivers (A, B, C) on the WIDER window; everyone else on the narrower one.
    const rows = [
      ["A", 600, 40, 3000, W], ["B", 600, 38, 2850, W], ["C", 600, 36, 2700, W],
      ["M1", 400, 15, 1200, N], ["M2", 400, 15, 1200, N], ["M3", 400, 15, 1200, N], ["M4", 400, 15, 1200, N], ["M5", 400, 15, 1200, N],
      ["L1", 400, 10, 600, N], ["L2", 400, 10, 600, N], ["L3", 400, 10, 600, N],
    ];
    const csv = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value,Attribution setting\n" +
      rows.map(([n, s, p, v, w]) => `${n},${s},${p},${v},"${w}"`).join("\n") + "\n";
    const r = run(csv, "roas");
    const d = r.memo.decision;
    assert.deepEqual(d.budgetMove!.to.map((t) => t.window), Array(3).fill("7d click + 1d view + 1d engaged view"), "each receiver's window");
    assert.equal(
      d.windowNote?.buyer,
      "3 of 3 receivers use a different attribution window than most judged video/UGC ads (7d click + 1d view): 3 on a wider window (7d click + 1d view + 1d engaged view) — part of their lead may come from the counting, not the ad."
    );
    assert.match(d.windowNote!.client, /wider attribution window than most others/);
    assert.equal(r.memo.scope.attributionWarning, "Video/UGC ads (or ads with no format in the name) use mixed attribution windows: 7d click + 1d view on 8 ads, 7d click + 1d view + 1d engaged view on 3 ads — engaged view (video only: a view of 5+ seconds) counts for some and not others, so their ROAS isn't strictly comparable.");
    assert.equal(r.memo.scope.attributionClientLine, "Some video ads also count people who watched for 5+ seconds, so video results compare less precisely.");
    assert.ok(r.memo.confidence.decision.caps.buyer.includes("attribution windows differ among video/UGC ads (engaged view counts for video only)"));
    assert.notEqual(r.memo.confidence.decision.level, "high", "capped at medium");
    assert.ok(r.buyerText.includes("(€600.00 · 7d click + 1d view + 1d engaged view)"), "TXT shows the window beside the receiver");
    assert.ok(r.clientText.includes(r.memo.scope.attributionClientLine!));
    // Receivers on the NARROWER window: their lead is, if anything, understated.
    const flipped = run(csv.replaceAll(`"${W}"`, "X").replaceAll(`"${N}"`, `"${W}"`).replaceAll("X", `"${N}"`), "roas").memo;
    assert.match(flipped.decision.windowNote!.buyer, /3 on a narrower window \(7d click \+ 1d view\) — if anything, their lead is understated\.$/);
    // One window everywhere ⇒ no finding, no cap, windows still shown.
    const one = run(csv.replaceAll(`"${W}"`, `"${N}"`), "roas").memo;
    assert.equal(one.decision.windowNote, undefined);
    assert.equal(one.scope.attributionWarning, undefined);
    assert.ok(!one.confidence.decision.caps.buyer.some((c) => /attribution windows/.test(c)));
    // Merged rows on different windows ⇒ "mixed windows".
    const merged = run(csv + `A,100,5,500,"${N}"\n`, "roas").memo;
    assert.equal(merged.decision.budgetMove!.to.find((t) => t.name === "A")?.window, "mixed windows");
    // Report: exec summary, receiver window, card line, client line.
    const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
    assert.match(report, /\{ label: "Attribution", value: memo\.scope\.attributionWarning \}/);
    assert.match(report, /\{a\.window \? ` · \$\{a\.window\}` : ""\}/);
    assert.match(report, /\{client \? d\.windowNote\.client : d\.windowNote\.buyer\}/);
    // Pass C4: the client line lives in the Notes line under the card.
    assert.ok(r.clientText.includes("Notes: ") && r.clientText.split("\n").find((l) => l.startsWith("Notes: "))!.includes(r.memo.scope.attributionClientLine!));
  }

  /* ---- Bulletproof pass C1: attribution by format ---- */
  {
    const W = "7-day click, 1-day view or 1-day engaged view";
    const N = "7-day click or 1-day view";
    const build = (rows: (string | number)[][]) =>
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value,Attribution setting\n" +
      rows.map(([n, s, p, v, w]) => `${n},${s},${p},${v},"${w}"`).join("\n") + "\n";
    const base = (fmt: (n: string) => string, recv = W) => [
      [fmt("A"), 600, 40, 3000, recv], [fmt("B"), 600, 38, 2850, recv], [fmt("C"), 600, 36, 2700, recv],
      ...["M1", "M2", "M3", "M4", "M5"].map((n) => [fmt(n), 400, 15, 1200, N]),
      ...["L1", "L2", "L3"].map((n) => [fmt(n), 400, 10, 600, N]),
    ];
    // Every ad static: engaged view never applies — no caveat, no cap, no window beside receivers.
    const allStatic = run(build(base((n) => `${n}_Image`)), "roas").memo;
    assert.equal(allStatic.scope.attributionWarning, undefined);
    assert.equal(allStatic.scope.attributionClientLine, undefined);
    assert.equal(allStatic.decision.windowNote, undefined);
    assert.deepEqual(allStatic.decision.budgetMove!.to.map((t) => t.window), [undefined, undefined, undefined]);
    assert.ok(!allStatic.confidence.decision.caps.buyer.some((c) => /attribution/.test(c)), "no cap for static ads");
    assert.ok(allStatic.decision.limits.buyer.some((l) => l.includes("which Meta counts for video ads only — the judged video/UGC ads share one window and static ads are unaffected, so results compare fairly.")));
    // Image extension counts as static too.
    assert.equal(run(build(base((n) => `${n}_banner.jpg`)), "roas").memo.scope.attributionWarning, undefined);
    // Static receivers, video ads mixed among the rest: the finding stays (for video), the cap does not.
    const mixedVideo = build([
      ...base((n) => (["A", "B", "C"].includes(n) ? `${n}_Image` : `${n}_UGC`)).slice(0, 8),
      ["L1_UGC", 400, 10, 600, W], ["L2_UGC", 400, 10, 600, N], ["L3_UGC", 400, 10, 600, W],
    ]);
    const sv = run(mixedVideo, "roas").memo;
    assert.match(sv.scope.attributionWarning ?? "", /^Video\/UGC ads \(or ads with no format in the name\) use mixed attribution windows: .* Static ads are unaffected\.$/);
    assert.deepEqual(sv.decision.budgetMove!.to.map((t) => t.window), [undefined, undefined, undefined], "static receivers: no window caveat");
    assert.equal(sv.decision.windowNote, undefined);
    assert.ok(!sv.confidence.decision.caps.buyer.some((c) => /attribution/.test(c)), "static receivers: the window difference doesn't cap the decision");
    // A video receiver on a different window: capped, window shown.
    const vr = run(build(base((n) => `${n}_UGC`)), "roas").memo;
    assert.ok(vr.confidence.decision.caps.buyer.includes("attribution windows differ among video/UGC ads (engaged view counts for video only)"));
    assert.equal(vr.decision.budgetMove!.to[0].window, "7d click + 1d view + 1d engaged view");
    // Click windows differing (not just engaged view) affect every format.
    const clicks = run(build(base((n) => `${n}_Image`, "1-day click or 1-day view")), "roas").memo;
    assert.match(clicks.scope.attributionWarning ?? "", /^Mixed attribution windows: /);
    assert.ok(clicks.confidence.decision.caps.buyer.includes("attribution windows are mixed across ads"));
  }

  console.log("attributionColumns: all assertions passed");
} finally {
  cleanup();
}
