"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StateWrapper } from "@/components/ui/data";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Home</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            All connected ad accounts at a glance.
          </p>
        </div>
        {!connected && !loading && (
          <a
            href="/api/meta/oauth/start"
            className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
          >
            Connect Meta
          </a>
        )}
      </div>

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
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-white/5"
                />
              ))}
            </div>
          }
        >
          {!connected ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-10 text-center">
              <p className="text-sm font-medium text-zinc-200">
                Connect your Meta account to get started.
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                Read-only access. Two minutes from connect to your first
                account overview.
              </p>
              <a
                href="/api/meta/oauth/start"
                className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
              >
                Connect Meta
              </a>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map((account) => (
                <Link
                  key={account.externalId}
                  href={`/accounts/${encodeURIComponent(account.externalId)}`}
                  className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {account.name}
                    </p>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        account.status === "active"
                          ? "bg-emerald-400"
                          : "bg-zinc-600"
                      }`}
                      title={account.status}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {account.currency} · {account.timezone}
                  </p>
                  <p className="mt-3 text-xs font-medium text-zinc-400 group-hover:text-zinc-200">
                    View performance →
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
