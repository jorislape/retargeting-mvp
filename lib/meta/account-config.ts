export type MetaAccountConfig = {
  pixelId: string;
  campaignId: string;
  pageId: string;
};

export function normalizeAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

function parseAccountConfig(): Record<string, MetaAccountConfig> {
  const raw = process.env.META_ACCOUNT_CONFIG;

  if (!raw) {
    console.warn("[account-config] META_ACCOUNT_CONFIG is missing");
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, MetaAccountConfig>;

    if (typeof parsed !== "object" || parsed === null) {
      console.warn("[account-config] Invalid config format");
      return {};
    }

    return parsed;
  } catch (error) {
    console.error("[account-config] Failed to parse META_ACCOUNT_CONFIG", error);
    return {};
  }
}

export function getAllAccountConfigs() {
  return parseAccountConfig();
}

export function getAccountConfig(adAccountId: string) {
  const normalized = normalizeAccountId(adAccountId);
  const configs = parseAccountConfig();

  return configs[normalized] || null;
}