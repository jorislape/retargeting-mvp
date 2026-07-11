import { NextResponse } from "next/server";
import { MonitoringUnavailableError } from "./db/client.ts";
import { DISABLED_RESPONSE } from "./flag.ts";
import { ServiceError } from "./service.ts";

/**
 * Route-layer glue shared by all /api/monitoring/* handlers: uniform
 * no-store JSON, the flag-off body, and error mapping that NEVER
 * leaks internals — an unexpected failure (DB down included) becomes
 * the degraded "unavailable" body the UI renders as an inline card,
 * with a bare outcome-only log line.
 */

export function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function disabledResponse(): NextResponse {
  return jsonNoStore(DISABLED_RESPONSE, 200);
}

export function unavailableResponse(): NextResponse {
  return jsonNoStore({ ok: false, unavailable: true }, 200);
}

const SERVICE_ERROR_STATUS: Record<ServiceError["code"], number> = {
  invalid_url: 400,
  duplicate: 409,
  workspace_cap: 409,
  global_cap: 503,
  not_found: 404,
  cooldown: 429,
  daily_limit: 429,
};

export function mapError(e: unknown): NextResponse {
  if (e instanceof ServiceError) {
    return jsonNoStore(
      {
        ok: false,
        code: e.code,
        message: e.message,
        ...(e.retryAt && { retryAt: e.retryAt.toISOString() }),
      },
      SERVICE_ERROR_STATUS[e.code]
    );
  }
  if (e instanceof MonitoringUnavailableError) {
    return unavailableResponse();
  }
  // Unexpected: outcome-only log, degraded response, core unaffected.
  console.log("monitoring.route outcome=internal_error");
  return unavailableResponse();
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
