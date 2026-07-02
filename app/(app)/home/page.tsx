"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StateWrapper } from "@/components/ui/data";
import { EmptyState, PageHeader, StatusChip } from "@/components/ui/kit";
import { ArrowIcon, SearchIcon } from "@/components/ui/icons";
import {
  btnPrimary,
  cardCompact,
  cardHover,
  skeletonTile,
} from "@/components/ui/theme";

interface Account {
  externalId: string;
  name: string;
  currency: string;
  timezone: string;
  status: "active" | "disabled" | "unknown";
}

/* Search only earns its row once scanning the grid stops being instant. */
const SEARCH_THRESHOLD = 6;

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts");
      if (res.status === 401) {
        setConnected(false);
        setAccounts([]);
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "Failed to load ad accounts.");
        return;
      }
      setConnected(true);
      setAccounts(data.accounts);
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.externalId.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  return (
    <div>
      {/* One primary CTA per viewport (landing rule): the disconnected
          state below carries the Connect button, so no header action. */}
      <PageHeader
        title="Home"
        subtitle={
          !loading && connected && accounts.length > 0
            ? `${accounts.length} connected ad account${accounts.length === 1 ? "" : "s"}.`
            : "All connected ad accounts at a glance."
        }
      />

      <div className="mt-6">
        <StateWrapper
          loading={loading}
          error={error}
          onRetry={load}
          empty={connected && accounts.length === 0}
          emptyTitle="No ad accounts found on this Meta login."
          skeleton={
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={skeletonTile} />
              ))}
            </div>
          }
        >
          {!connected ? (
            <EmptyState
              title="Connect your Meta account to get started."
              description="Read-only access. Two minutes from connect to your first account overview."
              action={
                <a href="/api/meta/oauth/start" className={btnPrimary}>
                  Connect Meta
                </a>
              }
            />
          ) : (
            <>
              {accounts.length >= SEARCH_THRESHOLD && (
                <div className="relative mb-4 max-w-sm">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search accounts…"
                    aria-label="Search ad accounts by name or ID"
                    className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/60 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                </div>
              )}

              {filtered.length === 0 ? (
                <EmptyState
                  title={`No accounts match “${query.trim()}”.`}
                  description="Search matches account names and IDs."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((account) => (
                    <Link
                      key={account.externalId}
                      href={`/accounts/${encodeURIComponent(account.externalId)}`}
                      className={`group ${cardCompact} ${cardHover} p-4`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Initial avatar anchors each card for fast scanning */}
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-gradient-to-br from-blue-500/25 to-blue-600/5 text-sm font-bold text-blue-200"
                        >
                          {(account.name || "?").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-zinc-100">
                              {account.name}
                            </p>
                            <StatusChip status={account.status} />
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {account.currency} · {account.timezone}
                          </p>
                          <p className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition group-hover:text-white">
                            View performance
                            <ArrowIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </StateWrapper>
      </div>
    </div>
  );
}
