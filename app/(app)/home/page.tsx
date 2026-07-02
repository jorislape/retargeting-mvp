"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StateWrapper } from "@/components/ui/data";
import { EmptyState, PageHeader, StatusChip } from "@/components/ui/kit";
import { ArrowIcon } from "@/components/ui/icons";
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

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);

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

  return (
    <div>
      {/* One primary CTA per viewport (landing rule): the disconnected
          state below carries the Connect button, so no header action. */}
      <PageHeader
        title="Home"
        subtitle="All connected ad accounts at a glance."
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
            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map((account) => (
                <Link
                  key={account.externalId}
                  href={`/accounts/${encodeURIComponent(account.externalId)}`}
                  className={`group ${cardCompact} ${cardHover} p-4`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {account.name}
                    </p>
                    <StatusChip status={account.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {account.currency} · {account.timezone}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition group-hover:text-white">
                    View performance
                    <ArrowIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Link>
              ))}
            </div>
          )}
        </StateWrapper>
      </div>
    </div>
  );
}
