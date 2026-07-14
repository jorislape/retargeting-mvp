# Re-verify: /vs-chatgpt competitor-policy claims

`/vs-chatgpt` ("Debrief vs. ChatGPT, Claude & Gemini") states specific,
dated facts about how ChatGPT, Claude, and Gemini's **consumer/free
plans** handle chat data by default. These are exactly the kind of
claims that go stale silently — a provider updates a policy page and
the comparison on our site quietly becomes wrong. This document is the
checklist for catching that before a user does.

Last verified: **July 14, 2026**. Next review target: **October 2026**
(quarterly cadence — see below).

## The five approved primary sources

1. https://openai.com/policies/row-privacy-policy/
2. https://openai.com/index/response-to-nyt-data-demands/
3. https://www.anthropic.com/news/updates-to-our-consumer-terms
4. https://privacy.claude.com/en/articles/10023548-how-long-do-you-store-my-data
5. https://support.google.com/gemini/answer/13594961

Do not substitute a secondary source (a news article, a summary blog
post, a forum thread) for any of these while they remain live — always
check the primary source page itself.

## The exact claims that must be checked each cycle

**ChatGPT (consumer plans):**
- Model improvement is enabled by default, with opt-out in settings.
- Deleted chats are normally removed within about 30 days.
- A 2025 court order required retention of deleted consumer chats.
- That preservation obligation ended September 26, 2025.

**Claude (consumer plans):**
- Consumer training became opt-out/default-on in August 2025.
- Retention may extend up to 5 years when model improvement remains
  enabled.
- Retention is 30 days when opted out, subject to documented safety
  exceptions.

**Gemini (consumer):**
- Keep Activity is on by default.
- Human-reviewed chats may be retained for up to 3 years, separately
  from account activity.
- Google advises users not to enter confidential information they
  wouldn't want a reviewer to see.

**Framing claims** (not provider-specific, but must still hold):
- The comparison is scoped to consumer/free plans only — enterprise,
  Team, and API offerings are explicitly out of scope and described as
  "governed by separate terms not covered here."
- No sentence states or implies that every user is always trained on.
- No sentence states or implies that deleted chats are always
  retained.
- The closing line — "Every provider offers controls, and enterprise
  tiers differ. That is the point: their boundary depends on settings
  and policy. Debrief's raw-ads-data boundary is architectural." —
  still needs to be true, i.e. Debrief's own raw-ads-data promise on
  `/security` hasn't changed.

## Quarterly re-verification checklist

Run this every ~3 months, or immediately if you hear that any of the
three providers announced a privacy/retention/training policy change.

1. Open each of the five primary sources above. Confirm the page still
   exists at that URL and still supports the specific claim it's cited
   for.
2. For each claim in the list above, re-read the current source text
   and confirm it still matches, word-for-word in substance (not
   necessarily verbatim wording — policies get rephrased — but the
   same fact).
3. If a claim **still holds**: update the "Last verified" date at the
   top of this file, the "Policies verified July 14, 2026." line in
   `app/(workspace)/vs-chatgpt/page.tsx`'s `AI_POLICY_ROWS` section,
   and the page's footer note ("Competitor policy claims last verified
   July 14, 2026.") to the new date.
4. If a claim **can no longer be verified** — the source page changed,
   moved, or now says something different — do not leave the old
   claim in place. Either:
   - update the claim to match the new source text (only from a
     primary source, never inferred), or
   - if no primary source currently supports any version of the claim,
     **remove or soften it** rather than guess. A missing fact is
     always safer on this page than a wrong one.
5. If a provider launches a distinct enterprise/API data-handling
   policy that materially changes the "consumer vs. enterprise" framing
   this page relies on, flag that as a copy update, not just a date
   bump.
6. Re-run `npx tsc --noEmit`, `npx eslint .`, `npm test`, and
   `npm run build` after any content change, per the project's normal
   verification hygiene.

## Next review target

**October 2026.**
