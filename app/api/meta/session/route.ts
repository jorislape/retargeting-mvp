import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken } from "@/modules/auth";

/**
 * GET /api/meta/session — connection status for the current browser.
 *
 * `persisted` distinguishes DB-backed sessions (monitoring works) from
 * legacy cookie-only sessions (dashboard works, but the server has no
 * token — the user must reconnect once to enable monitoring).
 */
export async function GET(request: NextRequest) {
  const access = await resolveAccessToken(request);

  return NextResponse.json({
    ok: true,
    connected: !!access,
    persisted: access?.source === "db",
  });
}
