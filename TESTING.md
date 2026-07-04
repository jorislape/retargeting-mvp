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

- [ ] **Load**: click "Use sample data" (top-right of Data source) →
      dropzone shows the sample file, empty context fields prefill,
      typed values are kept.
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

## Report

- [ ] **Next tests are creative-first**: at least 2 of the 3 tests are
      creative/angle iterations naming specific ads; a "Scale budget"
      test appears ONLY when the top winner is ≥30% past the median
      (sample data: yes at +100%). A flat account gets 3 creative tests.
- [ ] **Buyer ⇄ Client toggle**: Client view shows Summary / What
      worked / What underperformed / What we'll test next / Confidence
      & what data was used — no "kill list" wording, KPI abbreviation
      explained under the title, "vs typical" table header.
- [ ] "Copy" copies the plain-text version of the ACTIVE view.
- [ ] Print/PDF exports the active view (`print-hidden` chrome
      disappears); Client view prints as a client-ready report.

## Onboarding

- [ ] "How to export from Meta Ads Manager" and "Columns we recognize"
      expanders under the dropzone open/close and read correctly.

## Layout

- [ ] Mobile (~375px): generator stacks to one column, dropzone and
      KPI grid usable, report readable, no horizontal scroll.
- [ ] `/sample` renders the same dataset via the real engine.
