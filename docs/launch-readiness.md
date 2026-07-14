# Launch readiness — Phase A

Status of the trust-surface work done in Phase A (branch
`phase-a-launch-readiness`, commits `launch-metadata-indexing` through
`launch-readiness-docs`). Everything marked done is code-only and shipped
on that branch; nothing here has been pushed, merged, or deployed.

## Metadata and indexing

- [x] `metadataBase` resolves to the real production URL automatically
      (`lib/site.ts`, via Vercel's `VERCEL_PROJECT_PRODUCTION_URL`) —
      previously fell back to `http://localhost:3000` in production
      because `NEXT_PUBLIC_SITE_URL` was never set. No manual env var
      needed for this to be correct today.
- [x] OG and Twitter card URLs are absolute (they resolve against
      `metadataBase`, which is now correct in production).
- [x] `alternates.canonical` set on every route: `/`, `/generator`,
      `/competitor-debrief`, `/sample`, `/how-it-works`, `/privacy`,
      `/security`, `/pricing`, `/about`, `/vs-chatgpt`.
- [x] `app/robots.ts` → `/robots.txt`: allows `/`, disallows `/api/`,
      points at the sitemap.
- [x] `app/sitemap.ts` → `/sitemap.xml`: lists all ten public routes.
- [x] Unique, ≤60-char page titles on every route (checked: the longest
      is `/vs-chatgpt` at 43 characters including the " · Debrief"
      suffix). Fixed a real double-branding bug along the way — every
      non-home page was rendering titles like "How it works — Debrief ·
      Debrief" because per-page titles included a manual "— Debrief"
      suffix on top of the root template; removed the manual suffixes.
- [x] `generator/page.tsx` is a Client Component and previously had no
      page-specific metadata at all (Next.js doesn't allow a `metadata`
      export from a Client Component). Added a sibling
      `generator/layout.tsx` Server Component to carry it.
- [x] No hardcoded `localhost` references found in production code
      paths (checked via repo-wide search; the only `localhost` fallback
      is the intentional local-dev branch in `lib/site.ts`).
- [x] Favicon (`app/favicon.ico`, `app/icon.svg`) and the dynamic OG
      image (`app/opengraph-image.tsx`) already existed pre-Phase-A and
      are unchanged — confirmed still wired correctly now that
      `metadataBase` is fixed.

## Privacy and security copy

- [x] `/privacy`'s lead claim tightened to concrete, falsifiable
      wording: "No login required. Ads data is never stored
      server-side. We do not store uploaded CSVs, raw pasted ads, ad
      names, spend figures, or row-level performance data — on any
      tier."
- [x] New `/security` page: session-only flows today, the two things
      that already persist server-side (competitor-monitoring beta,
      both opt-in, never ads data), and the planned-but-not-built
      opt-in structured-learnings workspace, explicitly marked as not
      shipped.
- [x] Both footers (marketing and workspace) link Privacy, Security,
      and the support email.

## Launch pages

- [x] `/pricing` — no billing integration, no invented prices, "Team"
      tier marked "Coming soon," mailto CTA to the existing support
      address.
- [x] `/about` — audience, what deterministic decision-support means,
      an explicit "what this doesn't do" section. No founder
      narrative.
- [x] `/vs-chatgpt` — the differentiator is workflow/rules/output/
      privacy/evidence, not a claim that ChatGPT can't analyze ads;
      explicitly concedes a skilled user can reproduce parts manually.
      The existing "why not ChatGPT" line on `/generator` is untouched.
- [x] All three (plus `/security`) added to the sitemap and to
      navigation — marketing `TopNav`, and a new secondary-links
      section in the workspace `Sidebar` kept separate from the
      primary nav so `MobileTabBar`'s fixed 6-column grid didn't need
      to grow.

## How it works

- [x] Downloadable sample CSV (reuses `SAMPLE_CSV_TEXT` /
      `SAMPLE_CSV_FILENAME` from `modules/debrief/sampleCsv.ts` via a
      new small client component, not a second implementation).
- [x] "Check the math yourself" section.
- [x] "Where this is going" roadmap-honesty section — explicit
      "not built yet."
- [x] "Current limitations" section (see `KNOWN_LIMITS.md`).
- [x] The existing scoring rules (`RULES` in
      `app/(workspace)/how-it-works/page.tsx`) are byte-identical to
      before Phase A — diffed to confirm.

## Support contact

- [x] `joris.adomas@gmail.com` — already the live support address on
      `/privacy` before Phase A (present in the repo's initial
      commit). Not invented this phase; extended consistently to
      `/security`, `/pricing`, `/about`, and both footers.
- [x] No broken or placeholder links found in the pages touched this
      phase.

## Outside this phase's scope — reported, not actioned

None of the following were installed, configured, or chosen — per the
explicit stop conditions for this phase:

- **Custom domain / DNS.** No custom domain is attached to this Vercel
  project today (confirmed via `vercel domains ls` — the account's one
  domain belongs to an unrelated project). Production currently serves
  from the Vercel-provided alias. `lib/site.ts` will pick up a custom
  domain automatically the moment one is attached and promoted to
  production — no code change needed then, only the domain purchase
  and DNS/Vercel dashboard steps themselves.
- **Redirect from the `.vercel.app` alias to a future custom domain.**
  Not applicable until a custom domain exists; flagged so it isn't
  forgotten once one does.
- **Analytics** (Plausible, Fathom, or otherwise). Not installed. No
  vendor chosen. Needs a decision.
- **Uptime monitor.** Not configured. Needs a vendor decision.
- **Mailbox setup beyond the existing address.** `joris.adomas@gmail.com`
  is a personal Gmail address doing duty as the support contact; a
  dedicated support mailbox (e.g. on a future custom domain) is a
  manual decision, not made here.
- **External email-capture service** for the `/pricing` "Coming soon"
  interest CTA. Currently just a `mailto:` link — no signup form, no
  ESP/CRM integration.

## Verification run at the end of every commit in this phase

`npx tsc --noEmit && npx eslint . && npm test && npm run build` — all
green after each of the five commits. `npm test` covers 14 script-test
suites (parser, watchlist, signal, competitor-debrief, monitoring ×6,
internal-learnings, strategic-patterns).
