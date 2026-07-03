"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui/kit";
import { ChevronDownIcon } from "@/components/ui/icons";
import { btnSecondary, btnSecondaryMd, eyebrow } from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* Settings: Meta connection + per-account monitoring thresholds.      */
/* ------------------------------------------------------------------ */

interface Thresholds {
  cpaSpikePct: number;
  roasDropPct: number;
  spendConcentrationPct: number;
  zeroSpendFloor: number;
  cpaSpikeEnabled: boolean;
  roasDropEnabled: boolean;
  spendConcentrationEnabled: boolean;
  spendStoppedEnabled: boolean;
}

interface MonitorAccount {
  id: string;
  externalId: string;
  name: string;
  currency: string;
  status: string;
  monitoringEnabled: boolean;
  thresholds: Thresholds;
}

const RULE_FIELDS: {
  numberKey: keyof Thresholds;
  enabledKey: keyof Thresholds;
  label: string;
  suffix: string;
  hint: string;
}[] = [
  {
    numberKey: "cpaSpikePct",
    enabledKey: "cpaSpikeEnabled",
    label: "CPA spike",
    suffix: "%",
    hint: "Alert when 3-day CPA rises this much above the 14-day baseline",
  },
  {
    numberKey: "roasDropPct",
    enabledKey: "roasDropEnabled",
    label: "ROAS drop",
    suffix: "%",
    hint: "Alert when 3-day ROAS falls this much below the 14-day baseline",
  },
  {
    numberKey: "spendConcentrationPct",
    enabledKey: "spendConcentrationEnabled",
    label: "Spend concentration",
    suffix: "%",
    hint: "Alert when one campaign carries more than this share of spend",
  },
  {
    numberKey: "zeroSpendFloor",
    enabledKey: "spendStoppedEnabled",
    label: "Spend stopped",
    suffix: "/day",
    hint: "Alert on zero-spend days when the prior week averaged above this",
  },
];

function MonitorAccountRow({ account }: { account: MonitorAccount }) {
  const [enabled, setEnabled] = useState(account.monitoringEnabled);
  const [values, setValues] = useState<Thresholds>(account.thresholds);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const patch = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/monitoring/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: account.id, ...body }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "save failed");
  }, [account.id]);

  const toggleMonitoring = async () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    try {
      await patch({ monitoringEnabled: next });
    } catch {
      setEnabled(!next);
    }
  };

  const saveThresholds = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await patch(values as unknown as Record<string, unknown>);
      setMessage("Saved");
      setTimeout(() => setMessage(null), 2500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-white/5 first:border-t-0">
      <div className="flex items-center gap-3 py-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggleMonitoring}
            className="h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
            aria-label={`Monitor ${account.name}`}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-100">
              {account.name || account.externalId}
            </span>
            <span className="block text-xs text-zinc-500">
              {account.currency} ·{" "}
              {enabled ? "monitored" : "monitoring off"}
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
        >
          Thresholds
          <ChevronDownIcon
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="pb-4 pl-7">
          <div className="grid gap-3 sm:grid-cols-2">
            {RULE_FIELDS.map((field) => (
              <div
                key={field.numberKey}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`${account.id}-${field.numberKey}`}
                    className="text-[13px] font-medium text-zinc-200"
                  >
                    {field.label}
                  </label>
                  <input
                    type="checkbox"
                    checked={values[field.enabledKey] as boolean}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [field.enabledKey]: e.target.checked,
                      }))
                    }
                    className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                    aria-label={`Enable ${field.label} rule`}
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    id={`${account.id}-${field.numberKey}`}
                    type="number"
                    min={0}
                    value={values[field.numberKey] as number}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [field.numberKey]: Number(e.target.value),
                      }))
                    }
                    className="h-9 w-24 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 text-sm tabular-nums text-zinc-100 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                  <span className="text-xs text-zinc-500">{field.suffix}</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  {field.hint}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={saveThresholds}
              disabled={saving}
              className={`${btnSecondary} disabled:cursor-default disabled:opacity-50`}
            >
              {saving ? "Saving…" : "Save thresholds"}
            </button>
            {message && (
              <span
                className={`text-xs ${message === "Saved" ? "text-emerald-400" : "text-red-300"}`}
                role="status"
              >
                {message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [accounts, setAccounts] = useState<MonitorAccount[] | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  useEffect(() => {
    fetch("/api/meta/session")
      .then((res) => res.json())
      .then((data) => {
        setConnected(!!data.connected);
        setPersisted(!!data.persisted);
      })
      .catch(() => setConnected(false));

    fetch("/api/monitoring/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setNeedsReconnect(!!data.needsReconnect);
          setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
        } else {
          setAccounts([]);
        }
      })
      .catch(() => setAccounts([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Connections, monitoring, and workspace."
      />

      <Card className="mt-6 max-w-xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-100">Meta Ads</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  connected === null
                    ? "animate-pulse bg-zinc-500"
                    : connected
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                }`}
              />
              {connected === null
                ? "Checking connection…"
                : connected
                  ? persisted
                    ? "Connected — monitoring enabled (~60-day session)."
                    : "Connected — reconnect once to enable scheduled monitoring."
                  : "Not connected."}
            </p>
          </div>
          <a href="/api/meta/oauth/start" className={`shrink-0 ${btnSecondaryMd}`}>
            {connected ? "Reconnect" : "Connect"}
          </a>
        </div>
      </Card>

      <Card className="mt-3 max-w-xl p-5 sm:p-6">
        <p className="text-sm font-semibold text-zinc-100">Monitoring</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Scheduled checks per ad account: CPA spikes, ROAS drops, spend
          concentration, and stopped delivery. Findings land in Alerts.
        </p>

        <div className="mt-4">
          {accounts === null ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-white/5" />
              <div className="h-10 animate-pulse rounded-lg bg-white/5" />
            </div>
          ) : needsReconnect ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[13px] leading-relaxed text-zinc-400">
              Monitoring needs a securely stored connection. Reconnect Meta
              once (read-only) and your accounts appear here with default
              thresholds.
            </p>
          ) : accounts.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[13px] text-zinc-400">
              No ad accounts synced yet. They appear automatically after
              connecting Meta.
            </p>
          ) : (
            <div>
              <p className={eyebrow}>
                {accounts.length} account{accounts.length === 1 ? "" : "s"}
              </p>
              <div className="mt-1">
                {accounts.map((account) => (
                  <MonitorAccountRow key={account.id} account={account} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-3 max-w-xl p-5 sm:p-6">
        <p className="text-sm font-semibold text-zinc-100">
          Branding &amp; delivery
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Logo, accent color, and report sender settings arrive with the
          Reports module (M4/M7).
        </p>
      </Card>
    </div>
  );
}
