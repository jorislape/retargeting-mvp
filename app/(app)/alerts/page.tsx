"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtAgo } from "@/components/ui/data";
import { PageHeader } from "@/components/ui/kit";
import { BellIcon, CheckIcon } from "@/components/ui/icons";
import { btnPrimary, btnSecondary, card, skeletonPanel } from "@/components/ui/theme";

interface Finding {
  id: string;
  rule: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  accountExternalId: string | null;
  accountName: string | null;
}

const SEVERITY_DOT: Record<Finding["severity"], string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-sky-400",
};

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [items, setItems] = useState<Finding[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/findings");
      const data = await res.json();
      if (!data.ok) {
        setError(true);
        return;
      }
      setNeedsReconnect(!!data.needsReconnect);
      setItems(Array.isArray(data.findings) ? data.findings : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Findings from scheduled account monitoring."
      />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <div className={`${skeletonPanel} h-16`} />
            <div className={`${skeletonPanel} h-16`} />
            <div className={`${skeletonPanel} h-16`} />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6"
          >
            <p className="text-sm font-semibold text-red-200">
              Couldn&apos;t load alerts
            </p>
            <button onClick={load} className={`mt-4 ${btnSecondary}`}>
              Retry
            </button>
          </div>
        ) : needsReconnect ? (
          /* Monitoring runs server-side and needs the stored connection.
             Pre-M2 sessions only have a browser cookie — one reconnect
             migrates them. */
          <div className={`${card} mx-auto max-w-xl p-8 text-center sm:p-10`}>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
              <BellIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-white">
              Reconnect once to switch on monitoring
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-400">
              Monitoring runs on a schedule without your browser open, so it
              needs a securely stored connection. Reconnect Meta once —
              read-only, about a minute — and checks start automatically.
            </p>
            <div className="mt-6">
              <a href="/api/meta/oauth/start" className={btnPrimary}>
                Reconnect Meta
              </a>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className={`${card} p-10 text-center`}>
            <CheckIcon className="mx-auto h-5 w-5 text-emerald-400" />
            <p className="mt-3 text-sm font-medium text-zinc-200">
              All quiet — no findings from recent checks.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
              Every monitored account is checked on schedule for CPA spikes,
              ROAS drops, stopped spend, and connection problems. Tune
              thresholds in{" "}
              <Link href="/settings" className="text-zinc-200 underline decoration-zinc-600 underline-offset-2 hover:text-white">
                Settings
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className={`${card} divide-y divide-white/5`}>
            {items.map((finding) => {
              const inner = (
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[finding.severity] ?? "bg-zinc-500"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {finding.accountName && (
                        <span className="text-[13px] font-semibold text-zinc-100">
                          {finding.accountName}
                        </span>
                      )}
                      <span className="text-[13px] text-zinc-300">
                        {finding.title}
                      </span>
                    </div>
                    {finding.detail && (
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                        {finding.detail}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-600">
                    {fmtAgo(new Date(finding.createdAt).getTime())}
                  </span>
                </div>
              );
              return finding.accountExternalId ? (
                <Link
                  key={finding.id}
                  href={`/accounts/${encodeURIComponent(finding.accountExternalId)}`}
                  className="block transition hover:bg-white/[0.03]"
                >
                  {inner}
                </Link>
              ) : (
                <div key={finding.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
