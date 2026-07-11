import { and, desc, eq, inArray, lte, notInArray, sql } from "drizzle-orm";
import { checkUrlSyntax } from "../competitor/ssrf.ts";
import { getDb, withTransaction } from "./db/client.ts";
import {
  checkEvents,
  monitoredCompetitors,
  snapshots,
  workspaces,
} from "./db/schema.ts";
import { runCheckAttempt, type CheckAttemptResult } from "./fetcher.ts";
import {
  diffSnapshots,
  parseStoredSnapshot,
  type StoredSnapshotSignals,
} from "./differ.ts";
import { type CheckOutcomeValue } from "./outcomes.ts";
import {
  buildCompetitorUpdate,
  nextCheckAt,
  planPersistence,
  retryAllowedAt,
} from "./scheduler.ts";
import { consumeRateLimit, RETRY_PER_WORKSPACE } from "./ratelimit.ts";
import { WORKSPACE_ACTIVE_WINDOW_MS } from "./workspace.ts";

/**
 * Monitoring service layer — every read/write is scoped by
 * workspace_id in the WHERE clause; there is no unscoped accessor to
 * misuse. Applies the pure plans from scheduler.ts. Logging policy:
 * hostname + outcome + duration only, never full URLs, tokens, or
 * page content.
 */

export const MAX_COMPETITORS_PER_WORKSPACE = 3;
export const MAX_URL_LENGTH = 2000;
export const DEFAULT_GLOBAL_URL_CAP = 500;
export const CRON_BATCH_SIZE = 25;
export const CRON_CONCURRENCY = 4;

function globalUrlCap(): number {
  const raw = Number(process.env.MONITORING_MAX_ACTIVE_URLS ?? "");
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_GLOBAL_URL_CAP;
}

/** Typed, user-safe service failures — routes map code → HTTP status. */
export class ServiceError extends Error {
  constructor(
    public readonly code:
      | "invalid_url"
      | "duplicate"
      | "workspace_cap"
      | "global_cap"
      | "not_found"
      | "cooldown"
      | "daily_limit",
    message: string,
    public readonly retryAt?: Date
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Canonical dedup form: lowercased host, default ports and fragments
 *  stripped (URL does most of this), no trailing slash except root. */
export function normalizeUrl(url: URL): string {
  const u = new URL(url.toString());
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/\.$/, "");
  if (
    (u.protocol === "https:" && u.port === "443") ||
    (u.protocol === "http:" && u.port === "80")
  ) {
    u.port = "";
  }
  let s = u.toString();
  if (u.pathname !== "/" && s.endsWith("/") && u.search === "") {
    s = s.slice(0, -1);
  }
  return s;
}

/** Validates a user-entered URL for monitoring. Rejects everything
 *  the fetch pipeline would refuse — including Ads Library URLs by
 *  policy — at ADD time, with the reason. */
export function validateMonitorUrl(raw: string): { url: URL; normalized: string } {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_URL_LENGTH) {
    throw new ServiceError("invalid_url", "Enter a valid page URL (max 2000 characters).");
  }
  const syn = checkUrlSyntax(trimmed);
  if (!syn.ok) {
    const messages: Record<typeof syn.reason, string> = {
      invalid_url: "That doesn't look like a valid web address.",
      scheme: "Only http:// and https:// pages can be monitored.",
      credentials: "URLs with embedded credentials can't be monitored.",
      port: "Only standard web ports (80/443) can be monitored.",
      blocked_host: "Local and internal addresses can't be monitored.",
      ip_private: "Local and internal addresses can't be monitored.",
      ads_library: "Ads Library pages are not monitored — landing pages only.",
    };
    throw new ServiceError("invalid_url", messages[syn.reason]);
  }
  return { url: syn.url, normalized: normalizeUrl(syn.url) };
}

/* ------------------------------ reads ----------------------------- */

export interface CompetitorView {
  id: string;
  url: string;
  paused: boolean;
  consecutiveFailures: number;
  createdAt: string;
  lastAttemptAt: string | null;
  lastOutcome: CheckOutcomeValue | null;
  lastSuccessAt: string | null;
  nextCheckAt: string;
  /** Latest stored snapshot (survives newer failed attempts). */
  latest: { fetchedAt: string; signals: StoredSnapshotSignals } | null;
  /** Diff of the latest two snapshots (null with <2 snapshots). */
  changes: string[] | null;
  meaningfulChange: boolean;
}

export async function listCompetitors(
  workspaceId: string
): Promise<CompetitorView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(monitoredCompetitors)
    .where(eq(monitoredCompetitors.workspaceId, workspaceId))
    .orderBy(monitoredCompetitors.createdAt);
  if (rows.length === 0) return [];

  const snaps = await db
    .select({
      id: snapshots.id,
      competitorId: snapshots.competitorId,
      fetchedAt: snapshots.fetchedAt,
      signalsJson: snapshots.signalsJson,
    })
    .from(snapshots)
    .where(
      inArray(
        snapshots.competitorId,
        rows.map((r) => r.id)
      )
    )
    .orderBy(desc(snapshots.fetchedAt));

  return rows.map((row) => {
    const mine = snaps.filter((s) => s.competitorId === row.id).slice(0, 2);
    const latest = mine[0] ? parseStoredSnapshot(mine[0].signalsJson) : null;
    const previous = mine[1] ? parseStoredSnapshot(mine[1].signalsJson) : null;
    const diff =
      latest !== null && previous !== null
        ? diffSnapshots(previous, latest)
        : null;
    return {
      id: row.id,
      url: row.url,
      paused: row.paused,
      consecutiveFailures: row.consecutiveFailures,
      createdAt: row.createdAt.toISOString(),
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      lastOutcome: row.lastOutcome,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      nextCheckAt: row.nextCheckAt.toISOString(),
      latest:
        latest !== null && mine[0]
          ? { fetchedAt: mine[0].fetchedAt.toISOString(), signals: latest }
          : null,
      changes: diff !== null && !diff.suppressed ? diff.changes : null,
      meaningfulChange: diff?.meaningful ?? false,
    };
  });
}

/* ------------------------------ writes ---------------------------- */

export async function addCompetitor(
  workspaceId: string,
  rawUrl: string
): Promise<void> {
  const { url, normalized } = validateMonitorUrl(rawUrl);
  const db = getDb();

  /* Global ceiling: approximate count-then-insert by design. */
  const [{ active }] = await db
    .select({ active: sql<number>`count(*)::int` })
    .from(monitoredCompetitors)
    .where(eq(monitoredCompetitors.paused, false));
  if (active >= globalUrlCap()) {
    throw new ServiceError(
      "global_cap",
      "The monitoring beta is at capacity right now — try again later."
    );
  }

  /* Per-workspace cap (3): race-free via a transaction that locks the
     workspace row before counting (Checkpoint 2 amendment 4). */
  try {
    await withTransaction(async (tx) => {
      await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .for("update");
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(monitoredCompetitors)
        .where(eq(monitoredCompetitors.workspaceId, workspaceId));
      if (count >= MAX_COMPETITORS_PER_WORKSPACE) {
        throw new ServiceError(
          "workspace_cap",
          `The beta monitors up to ${MAX_COMPETITORS_PER_WORKSPACE} pages per workspace.`
        );
      }
      await tx.insert(monitoredCompetitors).values({
        workspaceId,
        url: url.toString().slice(0, MAX_URL_LENGTH),
        normalizedUrl: normalized,
        // Due immediately: first check happens on the next daily run.
        nextCheckAt: new Date(),
      });
    });
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    const code = (e as { code?: string; cause?: { code?: string } }).code ??
      (e as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") {
      throw new ServiceError("duplicate", "That page is already being monitored.");
    }
    throw e;
  }
}

export async function removeCompetitor(
  workspaceId: string,
  competitorId: string
): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(monitoredCompetitors)
    .where(
      and(
        eq(monitoredCompetitors.id, competitorId),
        eq(monitoredCompetitors.workspaceId, workspaceId)
      )
    )
    .returning({ id: monitoredCompetitors.id });
  if (deleted.length === 0) {
    throw new ServiceError("not_found", "That competitor isn't in this workspace.");
  }
}

/** Manual resume after auto-pause: clears the streak and makes the
 *  competitor due, so the next daily run picks it up. */
export async function resumeCompetitor(
  workspaceId: string,
  competitorId: string
): Promise<void> {
  const db = getDb();
  const updated = await db
    .update(monitoredCompetitors)
    .set({ paused: false, consecutiveFailures: 0, nextCheckAt: new Date() })
    .where(
      and(
        eq(monitoredCompetitors.id, competitorId),
        eq(monitoredCompetitors.workspaceId, workspaceId)
      )
    )
    .returning({ id: monitoredCompetitors.id });
  if (updated.length === 0) {
    throw new ServiceError("not_found", "That competitor isn't in this workspace.");
  }
}

/** Manual retry: per-competitor cooldown (10min; 60min after a
 *  blocked outcome) + 10/workspace/day, then one immediate check. */
export async function retryCompetitor(
  workspaceId: string,
  competitorId: string
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(monitoredCompetitors)
    .where(
      and(
        eq(monitoredCompetitors.id, competitorId),
        eq(monitoredCompetitors.workspaceId, workspaceId)
      )
    )
    .limit(1);
  if (!row) {
    throw new ServiceError("not_found", "That competitor isn't in this workspace.");
  }

  const allowedAt = retryAllowedAt(row.lastAttemptAt, row.lastOutcome);
  if (allowedAt.getTime() > Date.now()) {
    throw new ServiceError(
      "cooldown",
      row.lastOutcome === "blocked"
        ? "This site blocked the last check — retries are limited to once an hour."
        : "Please wait a few minutes between retries of the same page.",
      allowedAt
    );
  }
  const allowed = await consumeRateLimit(db, RETRY_PER_WORKSPACE, workspaceId);
  if (!allowed) {
    throw new ServiceError(
      "daily_limit",
      "Manual retry limit reached for today (10 per day)."
    );
  }
  await executeCheck(row);
}

/* --------------------------- check engine ------------------------- */

type CompetitorRow = typeof monitoredCompetitors.$inferSelect;

/** One competitor's full check: attempt (+ the single in-run retry
 *  for transient outcomes), plan, persist. The failure matrix and
 *  never-touch-the-last-snapshot invariants live in planPersistence;
 *  this function only applies the plan. */
async function executeCheck(row: CompetitorRow): Promise<void> {
  const db = getDb();
  const startedAt = Date.now();

  let attempt: CheckAttemptResult = await runCheckAttempt(row.url);
  if (attempt.transient) {
    attempt = {
      ...(await runCheckAttempt(row.url)),
    };
    attempt.detail = `${attempt.detail} (after retry)`.slice(0, 200);
  }

  const [latestSnap] = await db
    .select({ contentHash: snapshots.contentHash })
    .from(snapshots)
    .where(eq(snapshots.competitorId, row.id))
    .orderBy(desc(snapshots.fetchedAt))
    .limit(1);

  const plan = planPersistence({
    attempt,
    latestSnapshotHash: latestSnap?.contentHash ?? null,
    consecutiveFailures: row.consecutiveFailures,
  });

  const now = new Date();
  const due = nextCheckAt(now);

  let insertedSnapshotId: string | null = null;
  if (plan.insertSnapshot && attempt.snapshot !== null) {
    const [snap] = await db
      .insert(snapshots)
      .values({
        competitorId: row.id,
        contentHash: attempt.snapshot.contentHash,
        signalsJson: attempt.snapshot.stored,
        httpStatus: attempt.httpStatus,
        finalUrl: (attempt.finalUrl ?? row.url).slice(0, MAX_URL_LENGTH),
      })
      .returning({ id: snapshots.id });
    insertedSnapshotId = snap.id;
  }

  /* The pure builder is the invariant: failure plans yield an update
     object with NO last_success_* keys (unit-tested), so a failed
     attempt cannot touch the surviving snapshot state. */
  await db
    .update(monitoredCompetitors)
    .set(buildCompetitorUpdate(plan, now, due, insertedSnapshotId))
    .where(eq(monitoredCompetitors.id, row.id));

  await db.insert(checkEvents).values({
    competitorId: row.id,
    outcome: plan.eventOutcome,
    detailTextShort: attempt.detail.slice(0, 200),
  });
  /* Prune history to the newest 20 rows per competitor. */
  const keep = db
    .select({ id: checkEvents.id })
    .from(checkEvents)
    .where(eq(checkEvents.competitorId, row.id))
    .orderBy(desc(checkEvents.at))
    .limit(20);
  await db
    .delete(checkEvents)
    .where(
      and(eq(checkEvents.competitorId, row.id), notInArray(checkEvents.id, keep))
    );

  /* Logging policy: hostname + outcome + duration. Nothing else. */
  let host = "unknown";
  try {
    host = new URL(row.url).hostname;
  } catch {
    /* keep "unknown" */
  }
  console.log(
    `monitoring.check host=${host} outcome=${plan.eventOutcome} ms=${Date.now() - startedAt}`
  );
}

/* ------------------------------ cron ------------------------------ */

export interface BatchReport {
  processed: number;
  outcomes: Partial<Record<CheckOutcomeValue, number>>;
  errors: number;
}

/**
 * One daily batch: due competitors (next_check_at <= now) from
 * non-paused competitors in non-paused, RECENTLY SEEN workspaces
 * (last_seen_at within 30 days — dormancy resume is automatic
 * because any visit refreshes last_seen_at and this query recomputes
 * eligibility every run). Bounded size, bounded concurrency, per-URL
 * isolation: one poisoned URL can never abort the batch.
 *
 * An unfinished batch is harmless BY CONSTRUCTION: a competitor's
 * next_check_at only moves after ITS check is persisted, so anything
 * not reached this run is still due and gets picked up on the next
 * daily pass.
 */
export async function processDueBatch(
  batchSize: number = CRON_BATCH_SIZE
): Promise<BatchReport> {
  const db = getDb();
  const activeSince = new Date(Date.now() - WORKSPACE_ACTIVE_WINDOW_MS);
  const due = await db
    .select({ competitor: monitoredCompetitors })
    .from(monitoredCompetitors)
    .innerJoin(
      workspaces,
      eq(monitoredCompetitors.workspaceId, workspaces.id)
    )
    .where(
      and(
        eq(monitoredCompetitors.paused, false),
        eq(workspaces.paused, false),
        sql`${workspaces.lastSeenAt} >= ${activeSince}`,
        lte(monitoredCompetitors.nextCheckAt, new Date())
      )
    )
    .orderBy(monitoredCompetitors.nextCheckAt)
    .limit(batchSize);

  const report: BatchReport = { processed: 0, outcomes: {}, errors: 0 };
  const queue = due.map((d) => d.competitor);

  /* Small worker pool — bounded concurrency, per-item try/catch. */
  const workers = Array.from(
    { length: Math.min(CRON_CONCURRENCY, queue.length) },
    async () => {
      for (;;) {
        const row = queue.shift();
        if (row === undefined) return;
        try {
          await executeCheck(row);
          report.processed += 1;
        } catch {
          /* One failure never aborts the batch. The row's
             next_check_at is untouched, so it self-heals: still due
             on the next daily run. Log outcome-level info only. */
          report.errors += 1;
          console.log("monitoring.check outcome=internal_error");
        }
      }
    }
  );
  await Promise.all(workers);

  /* Outcome tally for the cron response (no URLs, no hosts). */
  return report;
}
