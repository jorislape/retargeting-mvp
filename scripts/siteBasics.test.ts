/**
 * Site Basics — proofs: the root 404 (title, noindex, two links), the
 * plain-language Terms page (required sections; Founding Pilot wording
 * identical to /founding — no new commercial terms; links /privacy;
 * same contact email), its sitemap entry and footer links, and the
 * 180×180 apple-touch icon.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/* 404 */
{
  const nf = read("app/not-found.tsx");
  assert.match(nf, /title: "Not found"/, "root template appends \" · Debrief\"");
  assert.match(read("app/layout.tsx"), /template: "%s · Debrief"/);
  assert.match(nf, /robots: \{ index: false/);
  assert.match(nf, /This page doesn&apos;t exist\./);
  assert.match(nf, /href="\/generator"[\s\S]{0,80}Generator/);
  assert.match(nf, /href="\/sample"[\s\S]{0,80}Sample report/);
}

/* Terms */
{
  const t = read("app/(workspace)/terms/page.tsx");
  for (const title of ["What Debrief is", "Your decisions stay yours", "No guarantee of results", "The free tool, as-is", "The Founding Pilot", "Liability"])
    assert.match(t, new RegExp(`title: "${title}"`), title);
  assert.match(t, /deterministic decision support for Meta Ads, currently in beta/);
  assert.match(t, /confirm the underlying figures in Meta Ads Manager/);
  assert.match(t, /provided as-is/);
  // The pilot sentence is copied from /founding's FAQ, not reworded.
  const pilot = "The Founding Pilot is €149 for an initial 30 days, arranged manually and paid by invoice — no auto-renewal; continuing past 30 days means a new, separate agreement. The Debrief software itself stays free either way.";
  assert.ok(t.includes(pilot), "terms pilot wording");
  assert.ok(read("app/(workspace)/founding/page.tsx").includes(pilot.replace(/^The Founding Pilot is/, "Yes. The Founding Pilot is")), "matches /founding");
  assert.match(t, /href="\/privacy"/);
  const email = (read("app/(workspace)/privacy/page.tsx").match(/mailto:([^"]+)"/) ?? [])[1];
  assert.ok(email && t.includes(`mailto:${email}"`), "same contact email as /privacy");
  assert.match(t, /canonical: "\/terms"/);
}

/* Sitemap + footers */
{
  assert.match(read("app/sitemap.ts"), /\{ path: "\/terms", priority: 0\.3 \}/);
  for (const f of ["app/(workspace)/layout.tsx", "app/(marketing)/layout.tsx"]) {
    const src = read(f);
    const footer = src.slice(src.indexOf("<footer"));
    const iPriv = footer.indexOf('href="/privacy"');
    const iSec = footer.indexOf('href="/security"');
    const iTerms = footer.indexOf('href="/terms"');
    assert.ok(iTerms > 0, `${f}: Terms in footer`);
    assert.ok(Math.abs(iTerms - Math.max(iPriv, iSec)) < 400, `${f}: next to Privacy/Security`);
  }
}

/* apple-touch icon: a real 180×180 PNG */
{
  const png = readFileSync(join(ROOT, "app/apple-icon.png"));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 180);
  assert.equal(png.readUInt32BE(20), 180);
}

console.log("siteBasics: all assertions passed");
