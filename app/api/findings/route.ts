import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/modules/auth";
import { adAccounts, findings, getDb, isDbConfigured } from "@/modules/db";

/**
 * GET /api/findings — recent monitoring findings for the workspace.
 *
 * Findings require a DB-backed session (monitoring runs server-side).
 * Legacy cookie-only sessions get `needsReconnect: true` so the UI can
 * prompt a one-time reconnect instead of showing a dead error.
 */
export async function GET(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, needsReconnect: true, findings: [] });
  }

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ ok: true, needsReconnect: true, findings: [] });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: findings.id,
        rule: findings.rule,
        severity: findings.severity,
        title: findings.title,
        detail: findings.detail,
        periodStart: findings.periodStart,
        periodEnd: findings.periodEnd,
        createdAt: findings.createdAt,
        accountExternalId: adAccounts.externalId,
        accountName: adAccounts.name,
      })
      .from(findings)
      .leftJoin(adAccounts, eq(adAccounts.id, findings.adAccountId))
      .where(eq(findings.workspaceId, session.workspaceId))
      .orderBy(desc(findings.createdAt))
      .limit(100);

    return NextResponse.json({ ok: true, needsReconnect: false, findings: rows });
  } catch (error) {
    console.error("findings: query failed", error);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}
