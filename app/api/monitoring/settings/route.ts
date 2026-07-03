import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getSession } from "@/modules/auth";
import {
  adAccounts,
  getDb,
  isDbConfigured,
  monitorSettings,
} from "@/modules/db";
import { DEFAULT_THRESHOLDS } from "@/modules/monitoring";

/**
 * GET  /api/monitoring/settings — accounts + per-account thresholds
 *      (missing settings rows mean "defaults").
 * PATCH /api/monitoring/settings — update one account's monitoring
 *      toggle and/or thresholds. Settings rows are created lazily.
 */

export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, needsReconnect: true, accounts: [] });
  }
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ ok: true, needsReconnect: true, accounts: [] });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: adAccounts.id,
        externalId: adAccounts.externalId,
        name: adAccounts.name,
        currency: adAccounts.currency,
        status: adAccounts.status,
        monitoringEnabled: adAccounts.monitoringEnabled,
        settings: monitorSettings,
      })
      .from(adAccounts)
      .leftJoin(
        monitorSettings,
        eq(monitorSettings.adAccountId, adAccounts.id)
      )
      .where(eq(adAccounts.workspaceId, session.workspaceId))
      .orderBy(asc(adAccounts.name));

    return NextResponse.json({
      ok: true,
      needsReconnect: false,
      defaults: DEFAULT_THRESHOLDS,
      accounts: rows.map((row) => ({
        id: row.id,
        externalId: row.externalId,
        name: row.name,
        currency: row.currency,
        status: row.status,
        monitoringEnabled: row.monitoringEnabled,
        thresholds: row.settings
          ? {
              cpaSpikePct: row.settings.cpaSpikePct,
              roasDropPct: row.settings.roasDropPct,
              spendConcentrationPct: row.settings.spendConcentrationPct,
              zeroSpendFloor: row.settings.zeroSpendFloor,
              cpaSpikeEnabled: row.settings.cpaSpikeEnabled,
              roasDropEnabled: row.settings.roasDropEnabled,
              spendConcentrationEnabled: row.settings.spendConcentrationEnabled,
              spendStoppedEnabled: row.settings.spendStoppedEnabled,
            }
          : DEFAULT_THRESHOLDS,
      })),
    });
  } catch (error) {
    console.error("monitoring settings: query failed", error);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

/** Numeric fields with their allowed ranges. */
const NUMERIC_FIELDS: Record<string, { min: number; max: number }> = {
  cpaSpikePct: { min: 1, max: 1000 },
  roasDropPct: { min: 1, max: 100 },
  spendConcentrationPct: { min: 1, max: 100 },
  zeroSpendFloor: { min: 0, max: 1_000_000 },
};

const BOOLEAN_FIELDS = [
  "cpaSpikeEnabled",
  "roasDropEnabled",
  "spendConcentrationEnabled",
  "spendStoppedEnabled",
] as const;

export async function PATCH(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 500 }
    );
  }
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const accountId = body.accountId;
  if (typeof accountId !== "string") {
    return NextResponse.json(
      { ok: false, error: "accountId is required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const [account] = await db
    .select()
    .from(adAccounts)
    .where(eq(adAccounts.id, accountId))
    .limit(1);
  if (!account || account.workspaceId !== session.workspaceId) {
    return NextResponse.json(
      { ok: false, error: "account_not_found" },
      { status: 404 }
    );
  }

  // Validate and collect threshold updates.
  const thresholdUpdates: Record<string, number | boolean> = {};
  for (const [field, range] of Object.entries(NUMERIC_FIELDS)) {
    const value = body[field];
    if (value === undefined) continue;
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < range.min ||
      value > range.max
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `${field} must be a number between ${range.min} and ${range.max}`,
        },
        { status: 400 }
      );
    }
    thresholdUpdates[field] = value;
  }
  for (const field of BOOLEAN_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      return NextResponse.json(
        { ok: false, error: `${field} must be a boolean` },
        { status: 400 }
      );
    }
    thresholdUpdates[field] = value;
  }

  try {
    if (typeof body.monitoringEnabled === "boolean") {
      await db
        .update(adAccounts)
        .set({ monitoringEnabled: body.monitoringEnabled, updatedAt: new Date() })
        .where(eq(adAccounts.id, accountId));
    }

    if (Object.keys(thresholdUpdates).length > 0) {
      await db
        .insert(monitorSettings)
        .values({ adAccountId: accountId, ...thresholdUpdates })
        .onConflictDoUpdate({
          target: monitorSettings.adAccountId,
          set: { ...thresholdUpdates, updatedAt: new Date() },
        });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("monitoring settings: update failed", error);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
