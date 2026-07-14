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
