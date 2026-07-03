import { NextRequest, NextResponse } from "next/server";
import { resolveAccessToken } from "@/modules/auth";
import { metaConnector } from "@/modules/connectors/meta";
import { ConnectorError } from "@/modules/connectors/types";

/** GET /api/accounts — connected ad accounts for the current session. */
export async function GET(request: NextRequest) {
  const access = await resolveAccessToken(request);
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "not_connected" },
      { status: 401 }
    );
  }

  try {
    const accounts = await metaConnector.fetchAdAccounts(access.accessToken);
    // The account list changes rarely — let the browser reuse it so
    // navigating back to Home is instant.
    return NextResponse.json(
      { ok: true, accounts },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    if (error instanceof ConnectorError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "auth_expired" ? 401 : 502 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}
