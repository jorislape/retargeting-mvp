/**
 * Monitoring beta — ISOLATION proofs (the "core survives monitoring's
 * death" guarantee):
 *
 *  1. Import graph: no file outside the monitoring dirs imports
 *     modules/monitoring — except the single sanctioned UI mount in
 *     GeneratorPanel, which may import components/monitoring ONLY.
 *  2. Client-bundle safety: components/monitoring may import from
 *     modules/monitoring at runtime ONLY the pure vocabulary module
 *     (outcomes.ts); anything else must be `import type`.
 *  3. The DB client is lazy: importing it with DATABASE_URL unset
 *     succeeds; only CALLING it throws the typed unavailable error.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...walk(join(ROOT, "app")),
  ...walk(join(ROOT, "components")),
  ...walk(join(ROOT, "modules")),
];

const isMonitoringFile = (rel: string) =>
  rel.startsWith("modules/monitoring/") ||
  rel.startsWith("app/api/monitoring/") ||
  rel.startsWith("components/monitoring/");

const SANCTIONED_UI_MOUNT = "components/debrief/GeneratorPanel.tsx";

for (const file of files) {
  const rel = relative(ROOT, file);
  if (isMonitoringFile(rel)) continue;
  const src = readFileSync(file, "utf8");
  const importLines = src
    .split("\n")
    .filter((l) => /^\s*(import|export)\b.*from\s+["']/.test(l));

  for (const line of importLines) {
    const spec = line.match(/from\s+["]([^"]+)["]|from\s+[']([^']+)[']/);
    const target = spec?.[1] ?? spec?.[2] ?? "";
    assert.ok(
      !/modules\/monitoring/.test(target),
      `CORE file imports modules/monitoring: ${rel} -> ${target}`
    );
    if (/components\/monitoring/.test(target)) {
      assert.equal(
        rel,
        SANCTIONED_UI_MOUNT,
        `only the sanctioned mount may import components/monitoring: ${rel}`
      );
    }
  }
}

// 2. Client components: runtime imports from modules/monitoring are
//    restricted to the pure outcomes vocabulary.
for (const file of walk(join(ROOT, "components/monitoring"))) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  for (const line of src.split("\n")) {
    const m = line.match(/^\s*import\s+(type\s+)?[^"']*["']([^"']*modules\/monitoring[^"']*)["']/);
    if (!m) continue;
    const isTypeOnly = m[1] !== undefined;
    const target = m[2];
    if (!isTypeOnly) {
      assert.ok(
        /modules\/monitoring\/outcomes/.test(target),
        `client monitoring file has a runtime server-module import: ${rel} -> ${target}`
      );
    }
  }
}

// 2b. FORM-SAFETY regression (qa-monitoring bug): MonitoringSection is
//     mounted inside GeneratorPanel's page-wide <form>. A nested
//     <form> is invalid HTML with undefined submit routing and caused
//     native full-page reloads on "Monitor weekly" in production.
//     Therefore NO monitoring component may render a <form> element or
//     a submit-typed button — every button must be explicitly
//     type="button", and Enter is handled via onKeyDown.
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

for (const file of walk(join(ROOT, "components/monitoring"))) {
  const rel = relative(ROOT, file);
  const code = stripComments(readFileSync(file, "utf8"));
  assert.ok(
    !/<form[\s>]/.test(code),
    `monitoring UI must not render <form> (nested-form reload bug): ${rel}`
  );
  assert.ok(
    !/type=["']submit["']/.test(code),
    `monitoring UI must not use submit-typed buttons: ${rel}`
  );
  const buttonTags = code.match(/<button[\s\S]*?>/g) ?? [];
  for (const tag of buttonTags) {
    assert.ok(
      /type=["']button["']/.test(tag),
      `every monitoring <button> needs explicit type="button": ${rel} -> ${tag.split("\n")[0]}`
    );
  }
}

// 3. Lazy DB client under an empty environment.
delete process.env.DATABASE_URL;
const client = await import("../modules/monitoring/db/client.ts");
assert.equal(typeof client.getDb, "function"); // import itself succeeded
assert.throws(
  () => client.getDb(),
  (e: unknown) =>
    e instanceof Error && e.name === "MonitoringUnavailableError",
  "getDb without DATABASE_URL must throw the typed unavailable error"
);
await assert.rejects(
  () => client.withTransaction(async () => undefined),
  (e: unknown) =>
    e instanceof Error && e.name === "MonitoringUnavailableError"
);

console.log("monitoring-isolation: all assertions passed");
