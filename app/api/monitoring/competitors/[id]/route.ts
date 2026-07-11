import { NextRequest } from "next/server";
import {
  disabledResponse,
  jsonNoStore,
  mapError,
  UUID_RE,
} from "../../../../../modules/monitoring/http.ts";
import { monitoringEnabled } from "../../../../../modules/monitoring/flag.ts";
import { removeCompetitor } from "../../../../../modules/monitoring/service.ts";
import { resolveWorkspace } from "../../../../../modules/monitoring/workspace.ts";

/** DELETE /api/monitoring/competitors/:id — remove a monitored page.
 *  Scoped: the service deletes only within the caller's workspace. */

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!monitoringEnabled()) return disabledResponse();
  try {
    const { id } = await params;
    const ws = await resolveWorkspace(request, { create: false });
    if (ws.status !== "ok" || !UUID_RE.test(id)) {
      return jsonNoStore(
        { ok: false, code: "not_found", message: "Nothing to remove." },
        404
      );
    }
    await removeCompetitor(ws.workspaceId, id);
    return jsonNoStore({ ok: true });
  } catch (e) {
    return mapError(e);
  }
}
