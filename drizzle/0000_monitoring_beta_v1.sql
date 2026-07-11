CREATE TYPE "public"."check_outcome" AS ENUM('success', 'no_change', 'timeout', 'blocked', 'dns_error', 'invalid_url', 'redirect_loop', 'unsupported_content', 'too_large', 'ssrf_blocked', 'partial_parse', 'error');--> statement-breakpoint
CREATE TABLE "check_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" "check_outcome" NOT NULL,
	"detail_text_short" text
);
--> statement-breakpoint
CREATE TABLE "monitored_competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"next_check_at" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_outcome" "check_outcome",
	"last_success_at" timestamp with time zone,
	"last_success_snapshot_id" uuid
);
--> statement-breakpoint
CREATE TABLE "rate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"key_hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competitor_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	"signals_json" jsonb NOT NULL,
	"http_status" integer,
	"final_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_events" ADD CONSTRAINT "check_events_competitor_id_monitored_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."monitored_competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_competitors" ADD CONSTRAINT "monitored_competitors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_competitors" ADD CONSTRAINT "monitored_competitors_last_success_snapshot_id_snapshots_id_fk" FOREIGN KEY ("last_success_snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_competitor_id_monitored_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."monitored_competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_events_competitor_at_idx" ON "check_events" USING btree ("competitor_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_competitors_ws_url_uq" ON "monitored_competitors" USING btree ("workspace_id","normalized_url");--> statement-breakpoint
CREATE INDEX "monitored_competitors_due_idx" ON "monitored_competitors" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "monitored_competitors_ws_idx" ON "monitored_competitors" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rate_events_lookup_idx" ON "rate_events" USING btree ("kind","key_hash","at");--> statement-breakpoint
CREATE INDEX "snapshots_competitor_fetched_idx" ON "snapshots" USING btree ("competitor_id","fetched_at");