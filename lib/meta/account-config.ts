/**
 * Per-account config for the FROZEN retargeting module.
 *
 * Previously this file hardcoded real pixel/campaign/page IDs in source.
 * Those have been removed. If the retargeting module is re-enabled, supply
 * config via the META_ACCOUNT_CONFIG env var as JSON, e.g.:
 *
 * META_ACCOUNT_CONFIG='{"act_123":{"pixelId":"1","campaignId":"2","pageId":"3"}}'
 */
export type MetaAccountConfig = {
  pixelId: string;
  campaignId: string;
  pageId: string;
};

export function normalizeAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

function loadConfig(): Record<string, MetaAccountConfig> {
  const raw = process.env.META_ACCOUNT_CONFIG;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, MetaAccountConfig>;
  } catch {
    console.error("META_ACCOUNT_CONFIG is not valid JSON; ignoring.");
    return {};
  }
}

export function getAllAccountConfigs() {
  return loadConfig();
}

export function getAccountConfig(adAccountId: string) {
  const normalized = normalizeAccountId(adAccountId);
  return loadConfig()[normalized] || null;
}
