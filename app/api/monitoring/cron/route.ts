import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import {
  disabledResponse,
  jsonNoStore,
} from "../../../../modules/monitoring/http.ts";
import { monitoringEnabled } from "../../../../modules/monitoring/flag.ts";
import { processDueBatch } from "../../../../modules/monitoring/service.ts";

/**
 * The daily monitoring cron — registered in vercel.json. Vercel Cron
 * invokes GET with `Authorization: Bearer $CRON_SECRET`; POST is kept
 * for manual/ops invocation with the same secret.
 *
 * Behavior:
 *  - flag off        => no-op disabled body (Tier-1 rollback).
 *  - bad/missing key => 401, constant-time comparison.
 *  - DB down         => logs one outcome-only line, exits cleanly 200
 *                       (a 5xx would make Vercel alert/retry a job
 *                       that can't succeed; due-date selection makes
 *                       the next daily run pick everything up).
 *  - normal          => processes ONE bounded batch (25 due
 *                       competitors, concurrency 4, per-URL try/catch)
 *                       and reports outcome counts only — no URLs.
 *
 * Sizing (Checkpoint 1 condition): worst case per URL is 10s + one
 * 10s transient retry; 25 URLs at concurrency 4 => ceil(25/4) × 20s
 * = 140s worst case against maxDuration 300 (the default limit on
 * every current Vercel plan) — a 53% margin, above the required 30%.
 * An unfinished batch is harmless by construction: next_check_at
 * only advances per-competitor after its own check persists, so
 * leftovers are still due tomorrow.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Constant-time secret comparison; hashing first equalizes lengths
 *  so timingSafeEqual never throws on length mismatch. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  if (!monitoringEnabled()) return disabledResponse();

  const expected = (process.env.CRON_SECRET ?? "").trim();
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (expected === "" || provided === "" || !secretsMatch(provided, expected)) {
    return jsonNoStore({ ok: false }, 401);
  }

  try {
    const report = await processDueBatch();
    console.log(
      `monitoring.cron processed=${report.processed} errors=${report.errors}`
    );
    return jsonNoStore({ ok: true, ...report });
  } catch {
    console.log("monitoring.cron outcome=unavailable");
    return jsonNoStore({ ok: false, unavailable: true }, 200);
  }
}

export const GET = handle; // Vercel Cron invokes GET
export const POST = handle; // manual/ops invocation
