import { sql } from "drizzle-orm";
import type { AdAccount } from "../connectors/types";
import { getDb } from "./client";
import { adAccounts } from "./schema";

/**
 * Upsert the ad accounts visible to a connection. Used by the OAuth
 * callback (initial sync) and every monitor run (keeps names/status
 * fresh). Accounts that disappear from Meta are kept — history and
 * findings still reference them.
 */
export async function upsertAdAccounts(
  workspaceId: string,
  connectionId: string,
  accounts: AdAccount[]
): Promise<void> {
  if (accounts.length === 0) return;
  const db = getDb();
  await db
    .insert(adAccounts)
    .values(
      accounts.map((a) => ({
        workspaceId,
        connectionId,
        externalId: a.externalId,
        name: a.name,
        currency: a.currency,
        timezone: a.timezone,
        status: a.status,
      }))
    )
    .onConflictDoUpdate({
      target: [adAccounts.workspaceId, adAccounts.externalId],
      set: {
        connectionId: sql`excluded.connection_id`,
        name: sql`excluded.name`,
        currency: sql`excluded.currency`,
        timezone: sql`excluded.timezone`,
        status: sql`excluded.status`,
        updatedAt: new Date(),
      },
    });
}
