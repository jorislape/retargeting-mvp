import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Competitor Monitoring Beta V1 — the ONLY server-persisted data in   */
/* this product. Additive: nothing outside modules/monitoring reads or */
/* writes these tables, and the core product must keep working with    */
/* DATABASE_URL unset (see db/client.ts — the client is lazy and       */
/* instantiated only inside monitoring modules).                       */
/*                                                                     */
/* Ownership model: there are no user accounts. Every row hangs off a  */
/* pseudonymous workspace whose ID is the SHA-256 hash of a random     */
/* 256-bit token that lives ONLY in an httpOnly cookie (see            */
/* ../workspace.ts). Consequences, by design:                          */
/*   - clearing cookies permanently orphans the workspace's data       */
/*     (disclosed in the UI + privacy page);                           */
/*   - a future accounts milestone can migrate by letting a logged-in  */
/*     user "claim" the workspace their cookie still points at         */
/*     (workspace_id -> user_id backfill), so nothing here blocks it.  */
/*                                                                     */
/* Retention rules enforced in code, not constraints:                  */
/*   - a failed check NEVER modifies/deletes snapshots or              */
/*     last_success_snapshot_id;                                       */
/*   - identical content_hash -> check_event(no_change), NO snapshot   */
/*     row;                                                            */
/*   - check_events pruned to the newest ~20 per competitor at write   */
/*     time;                                                           */
/*   - workspaces unseen for 30 days stop being scheduled (computed    */
/*     from last_seen_at at query time); deleting dormant data after   */
/*     90 days is a documented follow-up, not implemented here.        */
/* ------------------------------------------------------------------ */

/** Every way a scheduled or manual check can end. `blocked` includes
 *  403/429/challenge pages — recorded honestly, never evaded. */
export const checkOutcome = pgEnum("check_outcome", [
  "success",
  "no_change",
  "timeout",
  "blocked",
  "dns_error",
  "invalid_url",
  "redirect_loop",
  "unsupported_content",
  "too_large",
  "ssrf_blocked",
  "partial_parse",
  "error",
]);

export const workspaces = pgTable("workspaces", {
  /** SHA-256 hex of the cookie token. The raw token is never stored,
   *  so a leaked database cannot be used to impersonate a workspace. */
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Touched (at most hourly) whenever the workspace calls a
   *  monitoring route. Scheduling skips workspaces unseen for 30 days
   *  — computed from this column at due-selection time, never stored
   *  as a flag. That makes dormancy resume AUTOMATIC: any returning
   *  visit refreshes last_seen_at, and the next daily run schedules
   *  the workspace again with no user action. (Distinct from
   *  per-competitor auto-pause after 4 consecutive failures, which is
   *  manual-resume only.) */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  paused: boolean("paused").notNull().default(false),
});

export const monitoredCompetitors = pgTable(
  "monitored_competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** URL exactly as the user entered it (validated, length-capped). */
    url: text("url").notNull(),
    /** Canonical form used for dedup (lowercased host, default port
     *  and fragment stripped, trailing slash normalized). */
    normalizedUrl: text("normalized_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set by auto-pause (4 consecutive failures) or a future explicit
     *  pause. User can resume from the UI. */
    paused: boolean("paused").notNull().default(false),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    /** Weekly cadence: set to now + 7d (+ jitter) after every attempt.
     *  The daily cron picks up rows with next_check_at <= now, so a
     *  missed or partial run self-heals on the next daily pass —
     *  nothing depends on a run completing. */
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastOutcome: checkOutcome("last_outcome"),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    /** The snapshot shown when newer attempts fail. Failed attempts
     *  never touch this; ON DELETE SET NULL only fires if the snapshot
     *  row itself is removed (which only happens via competitor
     *  cascade). Circular FK is emitted as an ALTER by drizzle-kit. */
    lastSuccessSnapshotId: uuid("last_success_snapshot_id").references(
      (): AnyPgColumn => snapshots.id,
      { onDelete: "set null" }
    ),
  },
  (t) => [
    /** One row per page per workspace — repeat adds are rejected.
     *  The 3-per-workspace cap is enforced race-free at add time via a
     *  transaction that locks the workspace row (SELECT ... FOR
     *  UPDATE) before counting; the global MONITORING_MAX_ACTIVE_URLS
     *  ceiling stays approximate count-then-insert by design. */
    uniqueIndex("monitored_competitors_ws_url_uq").on(
      t.workspaceId,
      t.normalizedUrl
    ),
    /** The cron's due-scan. */
    index("monitored_competitors_due_idx").on(t.nextCheckAt),
    index("monitored_competitors_ws_idx").on(t.workspaceId),
  ]
);

export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => monitoredCompetitors.id, { onDelete: "cascade" }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** SHA-256 hex of the CANONICALIZED extracted-signals JSON — not of
     *  the raw HTML, which churns (nonces, timestamps) and would make
     *  every check look like a change. Equal hash => no_change event,
     *  no new snapshot row. */
    contentHash: text("content_hash").notNull(),
    /** Extracted signals only (CompetitorPageSignals shape + an
     *  extraction-completeness marker). Full page copies are never
     *  stored. */
    signalsJson: jsonb("signals_json").notNull(),
    httpStatus: integer("http_status"),
    /** Where the fetch actually landed after guarded redirects. */
    finalUrl: text("final_url").notNull(),
  },
  (t) => [index("snapshots_competitor_fetched_idx").on(t.competitorId, t.fetchedAt)]
);

export const checkEvents = pgTable(
  "check_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitorId: uuid("competitor_id")
      .notNull()
      .references(() => monitoredCompetitors.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    outcome: checkOutcome("outcome").notNull(),
    /** <=200 chars, written by our own code only: outcome context like
     *  "HTTP 403" or "redirect limit exceeded". Never URLs, never page
     *  content, never tokens. */
    detailTextShort: text("detail_text_short"),
  },
  (t) => [index("check_events_competitor_at_idx").on(t.competitorId, t.at)]
);

/** DB-backed rate limiting — serverless instances share no memory, so
 *  counters live here. Rows are pruned opportunistically on use; the
 *  key is always a SHA-256 hash (of an IP or a workspace id), so raw
 *  IPs are never stored. */
export const rateEvents = pgTable(
  "rate_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** e.g. "mint_ip" | "retry_ws" — one namespace per limit. */
    kind: text("kind").notNull(),
    keyHash: text("key_hash").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_events_lookup_idx").on(t.kind, t.keyHash, t.at)]
);
