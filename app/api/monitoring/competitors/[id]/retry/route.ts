import { NextRequest } from "next/server";
import {
  disabledResponse,
  jsonNoStore,
  mapError,
  UUID_RE,
} from "../../../../../../modules/monitoring/http.ts";
import { monitoringEnabled } from "../../../../../../modules/monitoring/flag.ts";
import { retryCompetitor } from "../../../../../../modules/monitoring/service.ts";
import { resolveWorkspace } from "../../../../../../modules/monitoring/workspace.ts";

/**
 * POST /api/monitoring/competitors/:id/retry — one immediate manual
 * check. Rate-limited in the service: 1/competitor/10min (60min after
 * a blocked outcome), 10/workspace/day. Runs the same fetcher as the
 * cron; a failure updates status honestly and never touches the last
 * successful snapshot.
 */

export const dynamic = "force-dynamic";
/** A single check: 10s fetch + one 10s transient retry + persistence. */
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!monitoringEnabled()) return disabledResponse();
  try {
    const { id } = await params;
    const ws = await resolveWorkspace(request, { create: false });
    if (ws.status !== "ok" || !UUID_RE.test(id)) {
      return jsonNoStore(
        { ok: false, code: "not_found", message: "Nothing to retry." },
        404
      );
    }
    await retryCompetitor(ws.workspaceId, id);
    return jsonNoStore({ ok: true });
  } catch (e) {
    return mapError(e);
  }
}
