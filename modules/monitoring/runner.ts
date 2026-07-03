import { and, eq, gt, inArray } from "drizzle-orm";
import { metaConnector } from "../connectors/meta";
import { ConnectorError, InsightRow } from "../connectors/types";
import { summarize } from "../metrics";
import {
  adAccounts,
  connections,
  decryptToken,
  findings,
  getDb,
  jobRuns,
  monitorSettings,
  upsertAdAccounts,
} from "../db";
import {
  DEFAULT_THRESHOLDS,
  evaluateRules,
  MonitorThresholds,
  RuleFinding,
} from "./rules";

/* ------------------------------------------------------------------ */
/* Monitor run: for every active connection, refresh the account list, */
/* pull small comparison windows per monitored account, evaluate the   */
/* rules, and store deduplicated findings. Designed to be schedule-    */
/* agnostic: hourly and daily runs behave identically because windows  */
/* are daily-grain and findings dedupe per (account, rule, day).       */
/* ------------------------------------------------------------------ */

const BASELINE_DAYS = 14;
const CURRENT_DAYS = 3;
const ACCOUNT_CONCURRENCY = 4;
/** A "running" job younger than this blocks a new run (crash-safe lock). */
const LOCK_STALE_MINUTES = 10;

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return toIso(d);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]);
      }
    })
  );
  return results;
}

export interface MonitorStats {
  skipped: boolean;
  connections: number;
  accountsChecked: number;
  findingsCreated: number;
  errors: string[];
}

interface StoredFinding extends RuleFinding {
  workspaceId: string;
  adAccountId: string | null;
  dedupeKey: string;
  periodStart: string;
  periodEnd: string;
}

async function checkAccount(
  accessToken: string,
  account: typeof adAccounts.$inferSelect,
  thresholds: MonitorThresholds
): Promise<StoredFinding[]> {
  // One daily account-level call covers baseline + current + zero-spend
  // detection; one aggregated campaign call covers concentration.
  const [dailyRows, campaignRows] = await Promise.all([
    metaConnector.fetchInsights(accessToken, {
      accountExternalId: account.externalId,
      level: "account",
      range: {
        since: isoDaysAgo(BASELINE_DAYS + CURRENT_DAYS),
        until: isoDaysAgo(1),
      },
      daily: true,
    }),
    metaConnector.fetchInsights(accessToken, {
      accountExternalId: account.externalId,
      level: "campaign",
      range: { since: isoDaysAgo(CURRENT_DAYS), until: isoDaysAgo(1) },
      limit: 25,
    }),
  ]);

  const currentSince = isoDaysAgo(CURRENT_DAYS);
  const currentRows: InsightRow[] = [];
  const baselineRows: InsightRow[] = [];
  const spendByDate = new Map<string, number>();
  for (const row of dailyRows) {
    if (!row.date) continue;
    spendByDate.set(row.date, row.metrics.spend);
    (row.date >= currentSince ? currentRows : baselineRows).push(row);
  }

  // Missing days are zero-spend days: Meta omits rows without delivery.
  const yesterdaySpend = spendByDate.get(isoDaysAgo(1)) ?? 0;
  let priorWeekTotal = 0;
  for (let day = 2; day <= 8; day++) {
    priorWeekTotal += spendByDate.get(isoDaysAgo(day)) ?? 0;
  }

  const current = summarize(currentRows);
  const baseline = summarize(baselineRows);

  const ruleFindings = evaluateRules(
    {
      accountName: account.name || account.externalId,
      accountStatus: account.status,
      currency: account.currency,
      current,
      baseline,
      yesterdaySpend,
      priorWeekAvgDailySpend: priorWeekTotal / 7,
      campaigns: campaignRows.map((row) => ({
        name: row.entityName,
        spend: row.metrics.spend,
      })),
    },
    thresholds
  );

  const runDay = toIso(new Date());
  return ruleFindings.map((f) => ({
    ...f,
    workspaceId: account.workspaceId,
    adAccountId: account.id,
    dedupeKey: `${account.id}:${f.rule}:${runDay}`,
    periodStart: currentSince,
    periodEnd: isoDaysAgo(1),
  }));
}

export async function runMonitor(): Promise<MonitorStats> {
  const db = getDb();
  const stats: MonitorStats = {
    skipped: false,
    connections: 0,
    accountsChecked: 0,
    findingsCreated: 0,
    errors: [],
  };

  // Cheap lock: skip when a fresh run is already in flight.
  const inFlight = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.job, "monitor"),
        eq(jobRuns.status, "running"),
        gt(
          jobRuns.startedAt,
          new Date(Date.now() - LOCK_STALE_MINUTES * 60 * 1000)
        )
      )
    )
    .limit(1);
  if (inFlight.length > 0) {
    stats.skipped = true;
    return stats;
  }

  const [run] = await db
    .insert(jobRuns)
    .values({ job: "monitor", status: "running" })
    .returning();

  try {
    const activeConnections = await db
      .select()
      .from(connections)
      .where(eq(connections.status, "active"));
    stats.connections = activeConnections.length;
    const runDay = toIso(new Date());

    for (const connection of activeConnections) {
      let accessToken: string;
      try {
        accessToken = decryptToken(connection.tokenCiphertext);
      } catch (error) {
        stats.errors.push(`connection ${connection.id}: decrypt failed`);
        console.error("monitor: decrypt failed", connection.id, error);
        continue;
      }

      try {
        const fetched = await metaConnector.fetchAdAccounts(accessToken);
        await upsertAdAccounts(
          connection.workspaceId,
          connection.id,
          fetched
        );
      } catch (error) {
        if (
          error instanceof ConnectorError &&
          error.code === "auth_expired"
        ) {
          await db
            .update(connections)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(connections.id, connection.id));
          const inserted = await db
            .insert(findings)
            .values({
              workspaceId: connection.workspaceId,
              adAccountId: null,
              rule: "connection_expired",
              severity: "critical",
              title: "Meta connection expired — monitoring is paused",
              detail:
                "The stored Meta token no longer works. Reconnect from Settings to resume monitoring and reports.",
              metrics: { connectionId: connection.id },
              dedupeKey: `${connection.id}:connection_expired:${runDay}`,
            })
            .onConflictDoNothing({ target: findings.dedupeKey })
            .returning({ id: findings.id });
          stats.findingsCreated += inserted.length;
          continue;
        }
        stats.errors.push(`connection ${connection.id}: account sync failed`);
        console.error("monitor: account sync failed", connection.id, error);
        // Accounts already in the DB can still be checked below.
      }

      const monitored = await db
        .select()
        .from(adAccounts)
        .where(
          and(
            eq(adAccounts.connectionId, connection.id),
            eq(adAccounts.monitoringEnabled, true)
          )
        );
      if (monitored.length === 0) continue;

      const settingsRows = await db
        .select()
        .from(monitorSettings)
        .where(
          inArray(
            monitorSettings.adAccountId,
            monitored.map((a) => a.id)
          )
        );
      const settingsByAccount = new Map(
        settingsRows.map((s) => [s.adAccountId, s])
      );

      const perAccount = await mapLimit(
        monitored,
        ACCOUNT_CONCURRENCY,
        async (account) => {
          try {
            const row = settingsByAccount.get(account.id);
            const thresholds: MonitorThresholds = row
              ? {
                  cpaSpikePct: row.cpaSpikePct,
                  roasDropPct: row.roasDropPct,
                  spendConcentrationPct: row.spendConcentrationPct,
                  zeroSpendFloor: row.zeroSpendFloor,
                  cpaSpikeEnabled: row.cpaSpikeEnabled,
                  roasDropEnabled: row.roasDropEnabled,
                  spendConcentrationEnabled: row.spendConcentrationEnabled,
                  spendStoppedEnabled: row.spendStoppedEnabled,
                }
              : DEFAULT_THRESHOLDS;
            const result = await checkAccount(accessToken, account, thresholds);
            stats.accountsChecked += 1;
            return result;
          } catch (error) {
            stats.errors.push(
              `account ${account.externalId}: ${
                error instanceof ConnectorError ? error.code : "check failed"
              }`
            );
            console.error("monitor: account check failed", account.externalId, error);
            return [] as StoredFinding[];
          }
        }
      );

      const toInsert = perAccount.flat();
      if (toInsert.length > 0) {
        const inserted = await db
          .insert(findings)
          .values(toInsert)
          .onConflictDoNothing({ target: findings.dedupeKey })
          .returning({ id: findings.id });
        stats.findingsCreated += inserted.length;
      }
    }

    await db
      .update(jobRuns)
      .set({
        status: "ok",
        finishedAt: new Date(),
        stats: {
          connections: stats.connections,
          accountsChecked: stats.accountsChecked,
          findingsCreated: stats.findingsCreated,
          errors: stats.errors,
        },
      })
      .where(eq(jobRuns.id, run.id));
  } catch (error) {
    await db
      .update(jobRuns)
      .set({
        status: "error",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(jobRuns.id, run.id));
    throw error;
  }

  return stats;
}
