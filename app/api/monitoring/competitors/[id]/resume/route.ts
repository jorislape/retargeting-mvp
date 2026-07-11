import { NextRequest } from "next/server";
import {
  disabledResponse,
  jsonNoStore,
  mapError,
  UUID_RE,
} from "../../../../../../modules/monitoring/http.ts";
import { monitoringEnabled } from "../../../../../../modules/monitoring/flag.ts";
import { resumeCompetitor } from "../../../../../../modules/monitoring/service.ts";
import { resolveWorkspace } from "../../../../../../modules/monitoring/workspace.ts";

/**
 * POST /api/monitoring/competitors/:id/resume — clears an auto-pause
 * (4 consecutive failures) and marks the competitor due, so the next
 * daily run checks it again. Per-competitor resume is always manual;
 * workspace dormancy, by contrast, clears itself on any visit.
 */

export const dynamic = "force-dynamic";

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
        { ok: false, code: "not_found", message: "Nothing to resume." },
        404
      );
    }
    await resumeCompetitor(ws.workspaceId, id);
    return jsonNoStore({ ok: true });
  } catch (e) {
    return mapError(e);
  }
}
