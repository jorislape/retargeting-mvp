/**
 * Bulletproof pass C8 — the Safari print reminder (source scan; the
 * click flow was verified in a live WKWebView and in Chromium).
 *
 * In WebKit the first "Print / Save PDF" click shows an inline notice —
 * "In Safari: Show details → uncheck 'Print headers and footers'" — with
 * Print and "Don't show again"; elsewhere the click prints at once.
 * WebKit is detected with the same keyword the print CSS uses to exclude
 * it. "Don't show again" is one localStorage UI preference, read and
 * written in try/catch.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./testerFeedbackEngine.ts";

const src = readFileSync(join(ROOT, "components/report/PrintButton.tsx"), "utf8");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
assert.match(src, /CSS\.supports\("font: -apple-system-body"\)/, "WebKit check");
assert.ok(css.includes("(not (font: -apple-system-body))"), "…the same keyword the print CSS excludes WebKit with");
assert.match(src, /export const PRINT_REMINDER_KEY = "debrief\.printReminderDismissed\.v1";/);
assert.equal((src.match(/window\.localStorage\.(?:get|set)Item/g) ?? []).length, 2, "one read, one write");
for (const call of ["window.localStorage.getItem", "window.localStorage.setItem"]) {
  const at = src.indexOf(call);
  assert.match(src.slice(at - 40, at), /try \{\s*(?:return )?$/, `${call} sits inside try`);
}
assert.match(src, /onClick=\{\(\) => \(isWebKit\(\) && !dismissed\(\) \? setNotice\(true\) : window\.print\(\)\)\}/, "WebKit + not dismissed ⇒ notice; otherwise print");
assert.ok(src.includes("In Safari: <span") && src.includes("Show details</span> → uncheck") && src.includes("“Print headers and footers”</span>."), "notice copy");
assert.match(src, /rememberDismissed\(\);\s*print\(\);/, "Don't show again remembers, then prints");
assert.ok(/className="print-hidden flex basis-full/.test(src), "the notice never prints");
assert.ok(!/<button(?![^>]*type="button")/.test(src), "every button is type=button (reports sit inside the generator's form)");

for (const f of ["components/debrief/Report.tsx", "components/competitorDebrief/CompetitorDebriefResult.tsx"]) {
  const s = readFileSync(join(ROOT, f), "utf8");
  assert.ok(s.includes("<PrintButton />"), `${f} uses the shared button`);
  assert.ok(!s.includes("window.print()"), `${f} has no direct print call left`);
}
const claude = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
assert.ok(claude.includes("debrief.printReminderDismissed.v1"), "the extra localStorage key is recorded in the scope fence");

console.log("bulletproof print reminder: all assertions passed");
