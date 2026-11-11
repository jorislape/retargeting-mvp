# Known limits

Debrief is deterministic and rule-based, not predictive. This file states
plainly what it doesn't do, so nobody — user or contributor — has to
discover it the hard way. See `/how-it-works` and `/security` for the
user-facing versions of some of these.

## Competitor evidence

- **Image-only ads.** The competitor debrief and the competitor-page
  fetch both work from text. An ad that's purely an image with no
  caption, on-image copy, or transcription pasted in gives the engine
  nothing to read — there's no image analysis or OCR.
- **Video-only ads.** Same limit, no video analysis. A script or
  on-screen text has to be transcribed and pasted in for it to count as
  evidence.
- **Mixed-media meaning isn't inferred.** What an image and its caption
  communicate *together* — a visual joke, a demonstration a caption
  merely references — isn't reconstructed. Only the literal text
  provided is considered.
- **No automatic Meta Ads Library fetching, anywhere in the product.**
  Every competitor ad, URL, and note is something a user pastes or
  types in themselves. The one approved automated fetch (Competitor
  Landing Page Fetch V1) explicitly refuses Ads Library URLs by policy.

## Reading exports

- **English column names only.** Debrief reads Ads Manager's English
  headers. An export in another language is refused with "Column names
  not recognised" and the fix (switch Ads Manager to English (US) and
  export again) — translated headers are never guessed. Regional
  number formats (semicolons, decimal commas, dot / space thousands,
  currency in the cell) are read.
- **Attribution-window columns.** Split columns are recognised in the
  shapes `Purchases (7-day click)` / `Purchases [1-day view]` (1-day and
  7-day click, 1-day / 7-day view, 1-day engaged-view). Meta doesn't
  document its export spelling; a window column in another shape (e.g.
  28-day click) is not treated as a split — if it is the only purchase
  column it is read, and the file card names it with "check it's the
  conversion you mean".
- **A ROAS column with nothing else.** With only a ROAS column (no
  purchases, no purchase value), a blank ROAS cell stays "no ROAS
  value" — it can't be told apart from "not measured" — and an ad
  whose breakdown rows include one is set aside rather than given a
  guessed ROAS. Include Purchases or Purchases conversion value.
- **Two purchase scopes in one file.** When an export has both
  "Purchase ROAS" and "Website purchase ROAS" (or the matching count /
  value columns), the all-channel one is read and the file card names
  both. To judge website purchases only, export only those columns.

## Report output

- **Browser print-to-PDF limitations.** PDF export goes through the
  browser's native print dialog (`window.print()` + print CSS), not a
  dedicated PDF renderer. Pagination, header/footer margins, and exact
  color reproduction vary by browser and OS print driver. Long spend
  values can wrap in the report masthead on narrow print widths by
  design (`min-w-0` + `break-words`) rather than overflow.

## What these aren't

None of the above are bugs to silently work around — they're the
current, honest boundary of a deterministic, no-scraping, no-vision
product. Any change to them (image/video analysis, automatic Ads
Library reads, a dedicated PDF pipeline) is a new, explicit milestone,
not a quiet addition — see the scope fence in `CLAUDE.md`.
