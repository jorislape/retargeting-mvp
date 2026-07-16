/**
 * Meta Ad Library API spike — one-shot manual probe.
 *
 * NOT part of `npm test` (it makes a real network call and needs real
 * credentials — it must never run in CI or block the deterministic
 * test suite). Run it by hand:
 *
 *   META_AD_LIBRARY_ACCESS_TOKEN=... node scripts/metaAdLibraryProbe.ts [searchTerms] [countryCode]
 *
 * or via the npm alias:
 *
 *   META_AD_LIBRARY_ACCESS_TOKEN=... npm run meta-ad-library:probe -- Nike DE
 *
 * Defaults to searchTerms="Nike", countryCode="DE" — a real commercial
 * advertiser and a real EU country, per the spike's confirmed scoping
 * rule that non-political ads only return when ad_reached_countries
 * targets the EU (see modules/metaAdLibrary/client.ts's doc comment).
 *
 * No UI, no persistence, no database, no auth changes, no production
 * route. The token is read from an env var only, never logged, and
 * this script never logs response bodies containing it. Prints a
 * sanitized summary of what came back (or a clear classification of
 * why nothing did) so the spike's report can cite a real result.
 */
import { queryAdsArchive, AdLibraryApiError } from "../modules/metaAdLibrary/client.ts";
import { normalizeArchivedAd } from "../modules/metaAdLibrary/normalize.ts";

const searchTerms = process.argv[2] ?? "Nike";
const countryCode = process.argv[3] ?? "DE";

async function main() {
  const accessToken = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  if (!accessToken) {
    console.log("BLOCKED: META_AD_LIBRARY_ACCESS_TOKEN is not set.");
    console.log("");
    console.log("Next setup step (Meta Developer Console):");
    console.log("  1. developers.facebook.com -> your app -> Graph API Explorer.");
    console.log("  2. Select the app, request the ads_read permission (and complete");
    console.log("     any 'Confirm Your Identity' step Meta prompts for — this spike");
    console.log("     could not confirm from docs alone whether that gate applies to");
    console.log("     purely commercial EU ads or only political/issue ads).");
    console.log("  3. Generate a User Access Token and export it as");
    console.log("     META_AD_LIBRARY_ACCESS_TOKEN before re-running this script.");
    process.exitCode = 1;
    return;
  }

  console.log(`Querying ads_archive: search_terms="${searchTerms}" ad_reached_countries=["${countryCode}"] ad_type=ALL`);

  try {
    const response = await queryAdsArchive({
      accessToken,
      searchTerms,
      adReachedCountries: [countryCode],
      adType: "ALL",
      limit: 5,
    });

    const ads = response.data.map((raw) => normalizeArchivedAd(raw, null));

    console.log(`\nRESULT: ${ads.length} ad(s) returned.\n`);
    if (ads.length === 0) {
      console.log(
        "Zero results is itself informative here: either this advertiser has no ads " +
          "currently indexed for this country, or (per the spike's confirmed EU-scoping " +
          "rule) commercial ads only surface when the country targets the EU — try a " +
          "different EU country code or a different advertiser before concluding the " +
          "token/access itself is the problem."
      );
    }
    for (const ad of ads) {
      console.log("---");
      console.log(`  adId:          ${ad.adId}`);
      console.log(`  advertiserName:${ad.advertiserName ?? "(missing)"}`);
      console.log(`  headline:      ${ad.headline ?? "(missing)"}`);
      console.log(`  body:          ${ad.body ? ad.body.slice(0, 80) + (ad.body.length > 80 ? "..." : "") : "(missing)"}`);
      console.log(`  cta:           ${ad.cta ?? "(not exposed by this API — see spike report)"}`);
      console.log(`  startedAt:     ${ad.startedAt ?? "(missing)"}`);
      console.log(`  endedAt:       ${ad.endedAt ?? "(still running / missing)"}`);
      console.log(`  platforms:     ${ad.platforms.length ? ad.platforms.join(", ") : "(missing)"}`);
      console.log(`  snapshotUrl:   ${ad.snapshotUrl ?? "(missing)"}`);
      console.log(`  countries:     (not returned per-ad by this field set — see spike report)`);
    }

    console.log(`\nRaw field presence across ${ads.length} ad(s) (for the spike's fields report):`);
    const fieldNames: (keyof (typeof ads)[number])[] = [
      "advertiserName",
      "adId",
      "body",
      "headline",
      "cta",
      "startedAt",
      "endedAt",
      "platforms",
      "snapshotUrl",
    ];
    for (const field of fieldNames) {
      const present = ads.filter((a) => {
        const v = a[field];
        return v !== null && !(Array.isArray(v) && v.length === 0);
      }).length;
      console.log(`  ${field}: ${present}/${ads.length} present`);
    }
  } catch (err) {
    if (err instanceof AdLibraryApiError) {
      console.log(`\nBLOCKED: Graph API error (status=${err.status} code=${err.code ?? "n/a"} type=${err.type ?? "n/a"})`);
      console.log(`  message: ${err.message}`);
      if (err.isAuthError) {
        console.log(
          "  Classification: AUTH — the token is invalid, expired, or malformed. " +
            "Generate a fresh User Access Token in Graph API Explorer."
        );
      } else if (err.isPermissionError) {
        console.log(
          "  Classification: PERMISSION — the token is valid but isn't authorized for " +
            "the Ad Library API. Likely next step: complete Meta's identity confirmation " +
            "(facebook.com/ID) and/or Business Verification, then re-request ads_read " +
            "and regenerate the token. This spike could not confirm from documentation " +
            "alone which of these is actually required — this is the exact blocker to " +
            "resolve manually in the Developer Console."
        );
      } else if (err.isRateLimit) {
        console.log("  Classification: RATE LIMIT — wait and retry; no documented numeric ceiling was found for this edge.");
      } else {
        console.log("  Classification: OTHER — see message/code above.");
      }
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main();
