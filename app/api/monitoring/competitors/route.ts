import { NextRequest } from "next/server";
import {
  disabledResponse,
  jsonNoStore,
  mapError,
} from "../../../../modules/monitoring/http.ts";
import { monitoringEnabled } from "../../../../modules/monitoring/flag.ts";
import {
  addCompetitor,
  listCompetitors,
  MAX_COMPETITORS_PER_WORKSPACE,
  MAX_URL_LENGTH,
} from "../../../../modules/monitoring/service.ts";
import {
  resolveWorkspace,
  WORKSPACE_COOKIE,
  workspaceCookieOptions,
} from "../../../../modules/monitoring/workspace.ts";

/**
 * GET  /api/monitoring/competitors — the workspace's monitored pages.
 *      Never mints: a visitor without a workspace gets an empty state
 *      and NO cookie.
 * POST /api/monitoring/competitors — add a page (the one action that
 *      mints a workspace + sets the cookie; IP rate-limited).
 *
 * Flag off => both return the disabled body. All failures degrade to
 * an "unavailable" body — never a crash that could bleed into core.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!monitoringEnabled()) return disabledResponse();
  try {
    const ws = await resolveWorkspace(request, { create: false });
    if (ws.status !== "ok") {
      return jsonNoStore({
        ok: true,
        workspace: false,
        competitors: [],
        maxPerWorkspace: MAX_COMPETITORS_PER_WORKSPACE,
      });
    }
    const competitors = await listCompetitors(ws.workspaceId);
    return jsonNoStore({
      ok: true,
      workspace: true,
      competitors,
      maxPerWorkspace: MAX_COMPETITORS_PER_WORKSPACE,
    });
  } catch (e) {
    return mapError(e);
  }
}

export async function POST(request: NextRequest) {
  if (!monitoringEnabled()) return disabledResponse();
  try {
    let url: unknown;
    try {
      ({ url } = await request.json());
    } catch {
      url = null;
    }
    if (typeof url !== "string" || url.trim() === "" || url.length > MAX_URL_LENGTH) {
      return jsonNoStore(
        { ok: false, code: "invalid_url", message: "Enter the page URL to monitor." },
        400
      );
    }

    const ws = await resolveWorkspace(request, { create: true });
    if (ws.status === "rate_limited") {
      return jsonNoStore(
        {
          ok: false,
          code: "mint_rate_limited",
          message: "Too many new monitoring setups from this network — try again later.",
        },
        429
      );
    }
    if (ws.status !== "ok") {
      return jsonNoStore(
        { ok: false, code: "workspace", message: "Couldn't create a workspace." },
        500
      );
    }

    await addCompetitor(ws.workspaceId, url);
    const response = jsonNoStore({ ok: true }, 201);
    if (ws.setCookieToken !== null) {
      response.cookies.set(
        WORKSPACE_COOKIE,
        ws.setCookieToken,
        workspaceCookieOptions()
      );
    }
    return response;
  } catch (e) {
    return mapError(e);
  }
}
