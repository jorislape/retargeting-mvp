import { ConnectorError } from "../types";

/**
 * Single source of truth for the Graph API version.
 * (Previously the repo mixed v19.0 and v23.0 across routes.)
 */
export const META_API_VERSION = "v23.0";
export const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1500;

interface MetaErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
}

function classify(status: number, body: MetaErrorBody): ConnectorError {
  const err = body.error;
  const message = err?.message || `Meta API error (HTTP ${status})`;
  const code = err?.code;

  // OAuth / token problems
  if (code === 190 || status === 401) {
    return new ConnectorError(message, "auth_expired", false, body);
  }
  // Rate limiting: 4 (app), 17 (user), 32 (page), 613, 80000-80014 (BUC)
  if (
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613 ||
    (typeof code === "number" && code >= 80000 && code <= 80014)
  ) {
    return new ConnectorError(message, "rate_limited", true, body);
  }
  if (code === 200 || code === 10 || status === 403) {
    return new ConnectorError(message, "permission_denied", false, body);
  }
  if (status === 404 || code === 803) {
    return new ConnectorError(message, "not_found", false, body);
  }
  return new ConnectorError(message, "provider_error", status >= 500, body);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET a Graph API path with an access token, normalized errors, and
 * exponential backoff on retryable failures.
 */
export async function metaGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${META_GRAPH_URL}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);

  let lastError: ConnectorError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), { cache: "no-store" });
    } catch (networkError) {
      lastError = new ConnectorError(
        "Network error reaching Meta API",
        "provider_error",
        true,
        networkError
      );
      continue;
    }

    const body = (await response.json().catch(() => ({}))) as T &
      MetaErrorBody;

    if (response.ok && !body.error) {
      return body;
    }

    const error = classify(response.status, body);
    if (!error.retryable) throw error;
    lastError = error;
  }

  throw lastError ??
    new ConnectorError("Meta API request failed", "provider_error", false);
}

/** Follows Graph API cursor pagination, capped to avoid runaway requests. */
export async function metaGetAll<TItem>(
  accessToken: string,
  path: string,
  params: Record<string, string> = {},
  maxPages = 10
): Promise<TItem[]> {
  const items: TItem[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const pageParams = { ...params, ...(after ? { after } : {}) };
    const body = await metaGet<{
      data?: TItem[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(accessToken, path, pageParams);

    if (body.data?.length) items.push(...body.data);
    after = body.paging?.next ? body.paging?.cursors?.after : undefined;
    if (!after) break;
  }

  return items;
}
