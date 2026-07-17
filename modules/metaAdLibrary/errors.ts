import { AdLibraryApiError } from "./client.ts";

/**
 * Maps every way the "Search advertiser" flow can fail into the same
 * title / message / how-to-fix shape the rest of the product uses
 * (structured product guidance, never a raw Graph error string or a
 * stack trace). Pure so the copy for each failure class is
 * regression-tested in plain Node.
 *
 * The token itself never appears in any of these messages — Graph's
 * own error messages don't contain it (verified against live 190
 * responses), and the fallback path uses fixed copy rather than
 * echoing unknown upstream text to the browser.
 */

export interface AdLibrarySearchError {
  title: string;
  message: string;
  fix: string;
}

export const MISSING_TOKEN_ERROR: AdLibrarySearchError = {
  title: "Advertiser search isn't configured",
  message: "The server has no Meta Ad Library access token set.",
  fix: "Set META_AD_LIBRARY_ACCESS_TOKEN in the server environment, or use one of the paste modes instead.",
};

export const UNSUPPORTED_COUNTRY_ERROR: AdLibrarySearchError = {
  title: "Country not supported",
  message:
    "Advertiser search only covers EU countries and the UK — Meta's Ad Library API doesn't return commercial ads outside those markets.",
  fix: "Pick a supported country, or use one of the paste modes for other markets.",
};

export function describeAdLibraryError(err: AdLibraryApiError): AdLibrarySearchError {
  if (err.isAuthError) {
    return {
      title: "Meta access token expired",
      message: "Meta rejected the server's Ad Library access token — it has expired or been invalidated.",
      fix: "Generate a fresh User Access Token with ads_read and update META_AD_LIBRARY_ACCESS_TOKEN on the server.",
    };
  }
  if (err.isPermissionError) {
    return {
      title: "Meta permission denied",
      message: "The token is valid but isn't authorized for the Ad Library API.",
      fix: "Confirm identity verification is complete for the Meta account and the token was generated with ads_read.",
    };
  }
  if (err.isRateLimit) {
    return {
      title: "Meta rate limit reached",
      message: "Meta is temporarily throttling Ad Library requests from this server.",
      fix: "Wait a few minutes and try again, or use one of the paste modes meanwhile.",
    };
  }
  return {
    title: "Advertiser search failed",
    message: "Meta's Ad Library API returned an unexpected error.",
    fix: "Try again in a moment; if it keeps failing, use one of the paste modes.",
  };
}
