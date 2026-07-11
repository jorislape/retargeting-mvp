/**
 * The monitoring feature flag. OFF unless MONITORING_ENABLED is
 * exactly "true" or "1" — an unset, empty, or mistyped value means
 * off, so the default deployment state is: no monitoring routes, no
 * cron work, no UI section.
 *
 * Tier-1 rollback for the whole beta is flipping this off; nothing
 * else in the product changes (see CHECKPOINT/rollback docs).
 */
export function monitoringEnabled(): boolean {
  const v = (process.env.MONITORING_ENABLED ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
}

/** The uniform body every monitoring route returns when the flag is
 *  off — a stable shape the UI treats as "render nothing". */
export const DISABLED_RESPONSE = {
  ok: false as const,
  disabled: true as const,
};
