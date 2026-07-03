import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* M2 persistence foundation.                                          */
/*                                                                     */
/* Identity model: Meta OAuth IS the login. A user is keyed by their   */
/* Meta user id; their first login auto-creates a personal workspace.  */
/* Tokens are stored AES-256-GCM encrypted (see crypto.ts) and are     */
/* never serialized into API responses or cookies.                     */
/*                                                                     */
/* Deliberately deferred (per approved M2 scope): insights_daily,      */
/* historical sync, clients / client_ad_accounts.                      */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  metaUserId: text("meta_user_id").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* Minimum team model: owner-only memberships for now. */
export const memberships = pgTable(
  "memberships",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]
);

/* Browser sessions. The cookie holds a random token; only its SHA-256
   hash is stored, so a DB leak doesn't leak live sessions. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

/* Provider connections. tokenCiphertext format: "v1:" + base64(iv|tag|ct)
   — see modules/db/crypto.ts. */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("meta"),
    metaUserId: text("meta_user_id").notNull(),
    tokenCiphertext: text("token_ciphertext").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    status: text("status").notNull().default("active"), // active | expired
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("connections_workspace_provider_user_idx").on(
      t.workspaceId,
      t.provider,
      t.metaUserId
    ),
  ]
);

export const adAccounts = pgTable(
  "ad_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull().default(""),
    currency: text("currency").notNull().default("USD"),
    timezone: text("timezone").notNull().default("UTC"),
    status: text("status").notNull().default("unknown"), // active | disabled | unknown
    monitoringEnabled: boolean("monitoring_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ad_accounts_workspace_external_idx").on(
      t.workspaceId,
      t.externalId
    ),
  ]
);

/* Per-account thresholds. A missing row means "all defaults" — the
   runner merges with DEFAULT_THRESHOLDS (modules/monitoring), so rows
   are only created when a user changes something. */
export const monitorSettings = pgTable("monitor_settings", {
  adAccountId: uuid("ad_account_id")
    .primaryKey()
    .references(() => adAccounts.id, { onDelete: "cascade" }),
  cpaSpikePct: real("cpa_spike_pct").notNull().default(30),
  roasDropPct: real("roas_drop_pct").notNull().default(25),
  spendConcentrationPct: real("spend_concentration_pct").notNull().default(60),
  zeroSpendFloor: real("zero_spend_floor").notNull().default(5),
  cpaSpikeEnabled: boolean("cpa_spike_enabled").notNull().default(true),
  roasDropEnabled: boolean("roas_drop_enabled").notNull().default(true),
  spendConcentrationEnabled: boolean("spend_concentration_enabled")
    .notNull()
    .default(true),
  spendStoppedEnabled: boolean("spend_stopped_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* Findings produced by monitor runs. dedupeKey is unique so re-runs
   insert with ON CONFLICT DO NOTHING instead of duplicating. */
export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    adAccountId: uuid("ad_account_id").references(() => adAccounts.id, {
      onDelete: "cascade",
    }),
    rule: text("rule").notNull(), // cpa_spike | roas_drop | spend_concentration | spend_stopped | account_disabled | connection_expired
    severity: text("severity").notNull(), // critical | warning | info
    title: text("title").notNull(),
    detail: text("detail"),
    metrics: jsonb("metrics"),
    periodStart: text("period_start"), // ISO date (account timezone)
    periodEnd: text("period_end"),
    dedupeKey: text("dedupe_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("findings_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ]
);

/* Monitor run log: observability + a cheap lock (skip when a run is
   already in progress and younger than the stale window). */
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(), // "monitor"
    status: text("status").notNull().default("running"), // running | ok | error | skipped
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    stats: jsonb("stats"),
    error: text("error"),
  },
  (t) => [index("job_runs_job_started_idx").on(t.job, t.startedAt)]
);
