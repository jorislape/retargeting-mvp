import { NextRequest, NextResponse } from "next/server";
import { metaConnector } from "@/modules/connectors/meta";
import { ConnectorError } from "@/modules/connectors/types";

/** GET /api/accounts — connected ad accounts for the current session. */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("meta_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "not_connected" },
      { status: 401 }
    );
  }

  try {
    const accounts = await metaConnector.fetchAdAccounts(accessToken);
    return NextResponse.json({ ok: true, accounts });
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
