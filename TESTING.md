# Manual test checklist

Everything below runs against `npm run dev` with no env vars (except the
Meta cases, which need `META_APP_ID`/`META_APP_SECRET`). Nothing is
persisted anywhere, so every case starts clean after a refresh.

The sample dataset lives in `modules/debrief/sampleCsv.ts` (14 ads,
June 2026). Engine facts to check against: spend gate ≈ **$120.91**
(no target CPA), **11 judged / 3 set aside**, medians — ROAS 2.31×,
CPA $24.03, CTR 1.68%, CPC $0.57, Purchases 12, Leads 22. Every KPI has
5 winners and 5 losers around its median.

## Sample data

- [ ] **Load**: click "Load the sample dataset" in the helper row under
      the source tiles → the loaded strip shows the sample file, empty
      context fields prefill, typed values are kept.
- [ ] **ROAS** (default KPI) → Generate: `UGC_MorningRoutine_V1` tops
      winners (4.62×), `Static_StockPhoto_Generic_V1` in the kill list
      (0.62×), 3 ads set aside.
- [ ] **CPA**: winners are the *low*-CPA ads (`UGC_MorningRoutine_V1`
      $12.61), losers the high (`Static_StockPhoto_Generic_V1` $99.10)
      — polarity flipped vs ROAS. Also check **CPC** (lower-better) and
      **CTR/Leads/Purchases** (higher-better).
- [ ] **Low-spend exclusion**: `UGC_TikTokRemix_V1` (5.90× ROAS on
      $62.35) must be set aside, never a winner — same for
      `Carousel_IngredientBreakdown_V1` and `Video_Hook_FastCut_V4`.
- [ ] **Target CPA changes the gate**: set Target CPA = 25 → gate
      becomes $75 → `UGC_TikTokRemix_V1` is now judged (and wins).

## CSV upload

- [ ] Real Ads Manager CSV export still works end-to-end.
- [ ] Non-CSV file / empty CSV / CSV missing the KPI's column → clear
      400 error banner naming what's missing, no crash.

## Creative format confirmation

- [ ] **Section appears after load**: stage 3 (Verify) shows a quiet
      "load your data first" line until a CSV is loaded, then the
      collapsible "Confirm creative formats" block — deduped ad names,
      detected format from the name, and a Correct format dropdown per
      ad. Nothing is required; Run never blocks.
- [ ] **First 25 / show all**: a CSV with >25 distinct ads shows 25 rows
      plus "Show all N ads"; toggling back works; a huge CSV stays usable.
- [ ] **No corrections → identical output**: generating without touching
      the dropdowns produces the exact same memo as before the feature
      (sample expected numbers unchanged).
- [ ] **Corrected rows change wording only**: a confirmed ad's row reads
      "Format confirmed as … — user-provided context, not proof of why
      it performed"; unconfirmed ads keep "Ad name suggests…"; every
      number, order, and the kill list stay identical.
- [ ] **Patterns/tests/briefs pick it up**: with confirmations, Patterns
      and test "Signals used" append "(N formats user-confirmed)";
      briefs' Based on carries the same signal.
- [ ] **File change clears confirmations**: loading a different CSV (or
      the sample) resets the dropdowns and the count chip.

## Market notes & competitor sources

- [ ] **Competitor sources**: "Add competitor source" adds a card (name /
      URL / Ads Library links / notes); up to 5, the add button hides at
      the cap; Remove deletes a card; all fields optional and generation
      is never blocked by them.
- [ ] **Use as market notes**: appends a "Competitor sources:" +
      "Observed competitor context:" block to the market-notes field
      WITHOUT touching existing text; clicking again with unchanged
      sources doesn't duplicate the block; all-empty cards → amber "Add
      a competitor name, link, or note first."
- [ ] **Fetch page signals (one-time fetch)**: button on each source
      card is disabled with an empty URL; shows "Fetching…" then
      "Signals added"; extracted signals land in that card's Notes under
      "Fetched page signals (host) — observed on page, directional
      only:" WITHOUT touching existing notes; repeat fetch of an
      unchanged page doesn't duplicate the block.
- [ ] **Fetch guardrails**: invalid URL, localhost/127.0.0.1/private
      IPs/[::1]/169.254.169.254, file:/javascript:/data: URLs, custom
      ports, and decimal-IP spellings all return a structured
      user-friendly error (never a stack trace); a non-HTML URL returns
      "Not a web page"; facebook.com/ads/library URLs return the "not
      fetched in this version — paste manually" message.
- [ ] **Fetched signals flow like typed notes**: after a fetch, "Use as
      market notes" and "Structure notes" behave exactly as with manual
      notes, and the report's Market signal section picks them up.
- [ ] **Structure notes after merge**: still groups formats/hooks/offers,
      keeps every URL (website + Ads Library), carries competitor lines
      under "Raw notes", and stays idempotent.
- [ ] **Report**: merged notes produce the Market signal section (marked
      directional) exactly like hand-pasted notes; empty market notes →
      no market wording anywhere. No URL is ever fetched.

## Meta data source

- [ ] `GET /api/meta/config` shows the redirect URI; button disabled
      with amber notice when env vars are missing.
- [ ] Connect → popup → consent → connected card (green dot, account
      list).
- [ ] Account with no delivery in range → amber "No ads found for this
      account/date range…" guidance, not a red error.
- [ ] Date ranges: last 7/14/30/90 days (native presets) and last
      180/365 days (sent as time_range) all pull without error.
- [ ] Pull with data → file lands in the dropzone → Generate works.
- [ ] The loaded strip's preview shows rows, columns, total spend, the
      reporting date range, and the KPI columns available.
- [ ] Account without purchase tracking + ROAS selected → amber note in
      the Meta card: "ROAS is not available for this account/date
      range. Try … if available." — the file stays loaded and switching
      KPI in Context works.
- [ ] Permission-denied and rate-limited Graph responses surface their
      specific friendly messages, not the generic pull error.

## Report

- [ ] **Next tests are creative-first**: at least 2 of the 3 tests are
      creative/angle iterations naming specific ads; a "Scale budget"
      test appears ONLY when the top winner is ≥30% past the median
      (sample data: yes at +100%). A flat account gets 3 creative tests.
- [ ] **Buyer ⇄ Client toggle**: Client view shows Summary / What
      worked / What underperformed / What we'll test next / Confidence
      & what data was used — no "kill list" or "spend gate" wording,
      KPI abbreviation explained under the title.
- [ ] **Client view density**: top 3 performers each way as summary
      cards (not tables) with a "N more … full detail in the Buyer
      view" note; confidence reads "This result is based on 14 ads and
      $3,385.50 in ad spend…". Buyer view keeps full tables and notes.
- [ ] **Visual system (modern dark SaaS)**: cool graphite canvas with
      one quiet light source, soft translucent surface layers, white
      primary CTA, icy-cyan accent only on markers/selection/focus.
      The generator is four stages (Data / Context / Verify / Run) with
      light numbered step chips that fill as stages complete; input
      methods are equal tiles and loaded data lands in one accent strip;
      market/competitor inputs sit in one combined context area with a
      single shared directional caveat. The report opens with a
      short accent bar and reads as a structured document: stat row
      without boxes, numbered sections, ledger run-list. No serif, no
      gold, no neon, no glows. PDF flattens to ink-on-paper.
- [ ] **KPI selector**: underline-selected tabs with polarity arrows
      (↑ ROAS/CTR/Leads/Purchases, ↓ CPA/CPC).
- [ ] "Copy" copies the plain-text version of the ACTIVE view.
- [ ] Print/PDF exports the active view (`print-hidden` chrome
      disappears); Client view prints as a client-ready report.

## Onboarding

- [ ] "How to export from Meta Ads Manager" and "Columns we recognize"
      expanders under the dropzone open/close and read correctly.

## Home

- [ ] `/` renders the landing page: hero CTAs go to `/generator` and
      `/sample`; the pipeline visual shows inputs → engine → both
      mini reports (with real sample numbers); mobile stacks with
      rotated flow arrows.
- [ ] The generator lives at `/generator` and is unchanged.

## Layout

- [ ] Mobile (~375px): generator stacks to one column, dropzone and
      KPI grid usable, report readable, no horizontal scroll.
- [ ] `/sample` renders the same dataset via the real engine.
