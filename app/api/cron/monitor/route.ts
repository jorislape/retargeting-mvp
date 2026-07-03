import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/modules/db";
import { runMonitor } from "@/modules/monitoring";

/**
 * GET /api/cron/monitor — scheduled monitoring entry point.
 *
 * Triggered by Vercel Cron (see vercel.json — daily on Hobby; switching
 * to hourly is a one-line schedule change, the runner is cadence-
 * agnostic). Vercel sends `Authorization: Bearer $CRON_SECRET`
 * automatically when the env var is set; the same header works for
 * manual/local runs:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/monitor
 *
 * maxDuration: 60 is the ceiling on Hobby without Fluid Compute —
 * higher values fail DEPLOYMENT validation (local builds don't check
 * plan limits). Raise to 300 after enabling Fluid or upgrading to Pro.
 * A timeout mid-run is safe: job_runs' stale-lock window plus per-day
 * finding dedupe mean the next scheduled run simply picks up cleanly.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refuse to run unauthenticated rather than silently open the door.
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const stats = await runMonitor();
    return NextResponse.json({ ok: true, ...stats });
  } catch (error) {
    console.error("cron monitor failed", error);
    return NextResponse.json(
      { ok: false, error: "monitor_failed" },
      { status: 500 }
    );
  }
}
