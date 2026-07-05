import { NextRequest, NextResponse } from "next/server";
import { bearerToken, fetchAdAccounts, GraphApiError } from "@/modules/meta";

/**
 * GET /api/meta/ad-accounts — lists the connected user's ad accounts.
 *
 * The access token arrives in the Authorization header from the
 * client's memory and is forwarded to Graph the same way. Nothing is
 * stored; the response is the pass-through list, no-store.
 */

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) {
    return noStore({ ok: false, error: "Not connected to Meta." }, 401);
  }

  try {
    const accounts = await fetchAdAccounts(token);
    return noStore({ ok: true, accounts });
  } catch (error) {
    if (error instanceof GraphApiError && error.isAuthError) {
      return noStore(
        { ok: false, error: "Meta session expired — reconnect and try again." },
        401
      );
    }
    if (error instanceof GraphApiError && error.isPermissionError) {
      return noStore(
        {
          ok: false,
          error:
            "This Meta login doesn't have permission to list ad accounts. Check your access in Business Manager.",
        },
        403
      );
    }
    if (error instanceof GraphApiError && error.isRateLimit) {
      return noStore(
        {
          ok: false,
          error:
            "Meta is rate-limiting requests right now — wait a minute and try again.",
        },
        429
      );
    }
    return noStore(
      { ok: false, error: "Couldn't load your ad accounts from Meta." },
      502
    );
  }
}
