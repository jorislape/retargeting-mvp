export type MetaAccountConfig = {
  pixelId: string;
  campaignId: string;
  pageId: string;
};

export function normalizeAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_")
    ? adAccountId
    : `act_${adAccountId}`;
}

/**
 * 🔥 TEMP HARD CODED CONFIG (for MVP testing)
 * Replace values with YOUR real IDs
 */
const ACCOUNT_CONFIG: Record<string, MetaAccountConfig> = {
  "act_201748641892516": {
    pixelId: "799708716173896",
    campaignId: "120244221374590745",
    pageId: "548182271709244",
  },
};

export function getAllAccountConfigs() {
  return ACCOUNT_CONFIG;
}

export function getAccountConfig(adAccountId: string) {
  const normalized = normalizeAccountId(adAccountId);
  return ACCOUNT_CONFIG[normalized] || null;
}