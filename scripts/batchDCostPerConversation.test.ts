/**
 * Batch D4 — Cost per conversation (MENA WhatsApp / DM sales).
 *
 * "Messaging conversations started" (or Meta's "Results" on rows whose
 * Result indicator is a messaging event) is a KPI option, "Cost per
 * conversation" — the same CPA rules (gate, median, receivers by count),
 * worded in conversations, never purchases or sales.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const MSG = readFileSync(join(ROOT, "scripts/fixtures/messaging-conversations.csv"), "utf8");
const { run, requireCompiled, cleanup } = loadEngine();
try {
  const r = run(MSG, "cpa", { cpaOutcome: "conversation" });
  const a = r.analysis;
  assert.equal(a.cpaBasis, "conversations");
  // Fix 3: lowercase — the label sits mid-sentence.
  assert.equal(r.memo.scope.kpiLabel, "cost per conversation");
  assert.match(r.buyerText, /Past cost per conversation doesn't guarantee/);
  assert.ok(r.buyerText.includes("Set a target cost per conversation (your breakeven) for a profit-based trim list."));
  assert.ok(r.buyerText.includes("No target cost per conversation set — ads are ranked against this account's median cost per conversation"));
  const withTarget = run(MSG, "cpa", { cpaOutcome: "conversation", targetCpa: 40 });
  for (const [label, text] of [["no target", r.buyerText + r.clientText], ["target", withTarget.buyerText + withTarget.clientText]] as const)
    assert.ok(!/\bCPA\b/.test(text), `${label}: no "CPA" in conversation mode: ${text.match(/.{0,60}\bCPA\b.{0,30}/)?.[0]}`);
  assert.ok(withTarget.buyerText.includes("(3× your target cost per conversation)"));
  assert.equal(r.memo.scope.kpiExplainer, "Cost per conversation — what one started messaging conversation costs in ad spend");
  /* CPA rules: value = spend ÷ conversations, lower is better, count-based receivers. */
  const founder = r.ads.find((x) => x.name === "WA_Founder_Video_V1")!;
  assert.equal(founder.kpiValue, 1800 / 90);
  assert.equal(founder.conversions, 90);
  assert.equal(r.ads.find((x) => x.name === "WA_Zero_V10")?.zeroConversions, true, "a real 0 is a zero-outcome ad");
  assert.ok(a.winners.every((w) => (w.kpiValue as number) < (a.median as number)), "lower cost wins");
  assert.match(r.memo.decision.headline, /into 2 ads with \d+\+ conversations each\.$/);
  /* Copy: conversations, never purchases or sales. */
  for (const [view, text] of [["buyer", r.buyerText], ["client", r.clientText]] as const) {
    assert.ok(!/purchase/i.test(text), `${view}: ${text.match(/.{0,60}purchase.{0,30}/i)?.[0]}`);
    assert.ok(!/\bsales?\b/i.test(text), `${view}: ${text.match(/.{0,60}\bsales?\b.{0,30}/i)?.[0]}`);
    assert.match(text, /conversations/);
  }
  for (const s of clientStrings(r.memo)) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* "Results" counts conversations only on messaging-indicator rows. */
  const results = run(
    "Ad name,Amount spent (AED),Results,Result indicator\n" +
      ["A,900,45,actions:onsite_conversion.messaging_conversation_started_7d", "B,800,30,actions:onsite_conversion.messaging_conversation_started_7d",
       "C,700,20,actions:onsite_conversion.messaging_conversation_started_7d", "D,600,12,actions:onsite_conversion.messaging_conversation_started_7d",
       "E,500,40,actions:link_click"].join("\n") + "\n",
    "cpa",
    { cpaOutcome: "conversation" }
  );
  assert.equal(results.ads.find((x) => x.name === "A")?.conversions, 45);
  assert.equal(results.ads.find((x) => x.name === "E")?.conversions, null, "a link-click Results row is not a conversation");

  /* File check: the conversation run needs a conversations column. */
  const { checkExport } = requireCompiled("modules/debrief/fileCheck.js") as {
    checkExport: (t: string, k: string, size?: number, o?: string | null) => { ok: boolean; error?: { title: string; message: string } };
  };
  assert.equal(checkExport(MSG, "cpa", undefined, "conversation").ok, true);
  const plainCpa = checkExport(MSG, "cpa");
  assert.equal(plainCpa.ok, false, "purchase CPA on a messaging-only export still needs purchases");
  const noConv = checkExport("Ad name,Amount spent (EUR),Purchases\nA,100,3\nB,90,2\n", "cpa", undefined, "conversation");
  assert.equal(noConv.ok, false);
  assert.equal(noConv.error?.title, "Cost per conversation column not found");
  assert.match(noConv.error?.message ?? "", /Messaging conversations started/);

  /* Fix 2: a fresh KPI pick per file — conversations-only ⇒ Cost per
     conversation; a purchase export ⇒ ROAS, never the previous file's KPI. */
  const { kpiUsability, autoKpiForFile } = requireCompiled("modules/debrief/kpiUsability.js") as {
    kpiUsability: (rows: Record<string, string>[], columns: unknown) => Record<string, { usable: boolean }>;
    autoKpiForFile: (u: Record<string, { usable: boolean }>, conversationsFound: boolean) => { kpi: string; cpaOutcome: string | null } | null;
  };
  const { parseCsv, toTable } = requireCompiled("modules/debrief/csv.js") as { parseCsv: (t: string) => string[][]; toTable: (m: string[][]) => { headers: string[]; rows: Record<string, string>[] } };
  const { resolveColumns, conversationColumnsMissing } = requireCompiled("modules/debrief/columns.js") as { resolveColumns: (h: string[]) => unknown; conversationColumnsMissing: (c: unknown) => string[] };
  const pickFor = (csv: string) => {
    const { headers, rows } = toTable(parseCsv(csv));
    const cols = resolveColumns(headers);
    return autoKpiForFile(kpiUsability(rows, cols), conversationColumnsMissing(cols).length === 0);
  };
  assert.deepEqual(pickFor(MSG), { kpi: "cpa", cpaOutcome: "conversation" });
  assert.deepEqual(pickFor(readFileSync(join(ROOT, "scripts/fixtures/day-age-breakdown.csv"), "utf8")), { kpi: "roas", cpaOutcome: null });

  /* UI + route wiring. */
  const panel = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  assert.match(panel, /\{ value: "cpa", label: "Cost per conversation", outcome: "conversation" \}/);
  /* Fix 1: the file card names the selected KPI and lists the conversations column. */
  assert.match(panel, /conversationRun \? "Target cost per conversation" : "Target CPA"/, "fix 3: the target input label");
  assert.match(panel, /const selectedKpiLabel = conversationRun \? "Cost per conversation" : kpiDisplay\(fields\.kpi, true\);/);
  assert.match(panel, /\.\.\.\(preview\.conversationsFound \? \["Cost per conversation"\] : \[\]\)/);
  assert.match(panel, /KPI columns: \$\{previewKpiLabels\.join\(", "\) \|\| "none detected"\} — \$\{selectedKpiLabel\} selected\./);
  const provider = readFileSync(join(ROOT, "components/workspace/DebriefProvider.tsx"), "utf8");
  assert.match(provider, /body\.append\("cpaOutcome", "conversation"\)/);
  const route = readFileSync(join(ROOT, "app/api/debrief/route.ts"), "utf8");
  assert.match(route, /form\.get\("cpaOutcome"\) === "conversation"/);
  assert.match(route, /extractAds\(rows, columns, context\.kpi, context\.cpaOutcome\)/);

  console.log("batch D cost per conversation: all assertions passed");
} finally {
  cleanup();
}
