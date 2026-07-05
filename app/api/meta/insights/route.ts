import { NextRequest, NextResponse } from "next/server";
import {
  bearerToken,
  DATE_PRESETS,
  fetchAdInsights,
  GraphApiError,
  insightsToCsv,
} from "@/modules/meta";
import type { DatePreset } from "@/modules/meta";

/**
 * POST /api/meta/insights — pulls ad-level insights and returns them
 * as a "virtual CSV": text identical in shape to an Ads Manager
 * export. The client wraps it in a File and drops it into the same
 * pipeline as an uploaded CSV — the debrief engine is untouched.
 *
 * Statelessness matches /api/debrief: insights live in memory for
 * this request, the CSV text goes back to the browser, and nothing is
 * written or logged beyond structural error facts. The pull itself
 * sets use_unified_attribution_setting=true so numbers match what the
 * user sees in Ads Manager.
 */

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) {
    return noStore({ ok: false, error: "Not connected to Meta." }, 401);
  }

  let body: { accountId?: unknown; datePreset?: unknown };
  try {
    body = await request.json();
  } catch {
    return noStore({ ok: false, error: "Bad request." }, 400);
  }

  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  if (!/^act_\d+$/.test(accountId)) {
    return noStore({ ok: false, error: "Pick a valid ad account." }, 400);
  }

  const datePreset = body.datePreset as DatePreset;
  if (!DATE_PRESETS.includes(datePreset)) {
    return noStore({ ok: false, error: "Pick a valid date range." }, 400);
  }

  try {
    const result = await fetchAdInsights(token, accountId, datePreset);
    if (result.rows.length === 0) {
      // A valid outcome, not a fault: the account simply had no
      // delivery in the window. ok:true + empty so the client renders
      // a guidance state instead of an error.
      return noStore({ ok: true, empty: true, rowCount: 0 });
    }
    return noStore({
      ok: true,
      csv: insightsToCsv(result.rows, result.currency),
      rowCount: result.rows.length,
      currency: result.currency,
      dateStart: result.dateStart,
      dateStop: result.dateStop,
      truncated: result.truncated,
    });
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
            "This Meta login doesn't have permission to read that account's insights. Check your access in Business Manager, or upload a CSV instead.",
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
      { ok: false, error: "Couldn't pull ads from Meta. Try again." },
      502
    );
  }
}
