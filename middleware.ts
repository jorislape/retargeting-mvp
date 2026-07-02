import { NextRequest, NextResponse } from "next/server";

/**
 * Gates the frozen retargeting module (pages + API routes) behind
 * FEATURE_RETARGETING. One choke point instead of edits in 14 route files,
 * so unfreezing later is a one-line change.
 *
 * Note: middleware runs on the edge runtime, so the flag is read from
 * process.env directly rather than importing lib/flags (which is fine to
 * import, but kept inline here to make the edge constraint obvious).
 */

const RETARGETING_PAGES = ["/dashboard", "/launch"];

const RETARGETING_API_PREFIXES = [
  "/api/meta/activate-retargeting",
  "/api/meta/launch-retargeting",
  "/api/meta/create-ad",
  "/api/meta/create-adset",
  "/api/meta/create-audience",
  "/api/meta/create-campaign",
  "/api/meta/create-pixel",
  "/api/meta/preview-ad",
  "/api/meta/page-posts",
  "/api/meta/list-ads",
  "/api/meta/list-pages",
  "/api/meta/list-pixels",
  "/api/meta/pages",
  "/api/meta/pixels",
  "/api/meta/account-config-status",
];

export function middleware(request: NextRequest) {
  const retargetingEnabled = process.env.FEATURE_RETARGETING === "true";
  if (retargetingEnabled) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (RETARGETING_PAGES.some((p) => pathname === p)) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (RETARGETING_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.json(
      { ok: false, error: "This module is disabled." },
      { status: 404 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/launch", "/api/meta/:path*"],
};
