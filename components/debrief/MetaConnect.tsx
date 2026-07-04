"use client";

import { useEffect, useState } from "react";
import type { DatePreset } from "@/modules/meta/types";
import { DATE_PRESET_LABELS, DATE_PRESETS } from "@/modules/meta/types";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { useMeta } from "@/components/workspace/MetaProvider";
import { RefreshIcon, ZapIcon } from "@/components/ui/icons";
import { btnSecondaryMd, cardCompact, inputBase } from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* The second way into the pipeline: connect Meta read-only, pull      */
/* ad-level insights, and drop them into the generator as a "virtual   */
/* CSV" File. From that point on the flow is identical to an upload —  */
/* the engine never knows the difference.                              */
/*                                                                     */
/* Before offering the button, the component asks /api/meta/config     */
/* whether OAuth is configured at all. If not, the button is disabled  */
/* with the exact missing env vars — a dead-end popup never opens.     */
/* ------------------------------------------------------------------ */

interface MetaConfigState {
  checked: boolean;
  configured: boolean;
  /** The exact redirect URI this deployment sends to Facebook. */
  redirectUri: string | null;
  message: string | null;
}

function useMetaConfig(): MetaConfigState {
  const [state, setState] = useState<MetaConfigState>({
    checked: false,
    configured: false,
    redirectUri: null,
    message: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/meta/config", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        setState({
          checked: true,
          configured: data.configured === true,
          redirectUri: data.redirectUri ?? null,
          message: data.configured
            ? null
            : (data.error ??
              "Meta connection isn't configured on this deployment."),
        });
      } catch {
        if (cancelled) return;
        // Config check unreachable — leave the button usable; the
        // login route repeats the same check and fails safely.
        setState({
          checked: true,
          configured: true,
          redirectUri: null,
          message: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function MetaConnect() {
  const { status, accounts, token, error, connect, disconnect, expire } =
    useMeta();
  const { setFile } = useDebrief();
  const config = useMetaConfig();

  const [accountId, setAccountId] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullNote, setPullNote] = useState<string | null>(null);
  const [pullEmpty, setPullEmpty] = useState(false);

  const selectedAccount =
    accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;

  const pull = async () => {
    if (!token || !selectedAccount) return;
    setPulling(true);
    setPullError(null);
    setPullNote(null);
    setPullEmpty(false);
    try {
      const res = await fetch("/api/meta/insights", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountId: selectedAccount.id, datePreset }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (res.status === 401) {
          expire(data.error ?? "Meta session expired — reconnect.");
        } else {
          setPullError(data.error ?? "Couldn't pull ads from Meta.");
        }
        return;
      }
      if (data.empty) {
        // Connected fine, account just has no delivery in the window —
        // guidance, not an error.
        setPullEmpty(true);
        return;
      }
      // The virtual CSV: same bytes an Ads Manager export would have.
      const name = `Meta — ${selectedAccount.name} — ${DATE_PRESET_LABELS[datePreset]}.csv`;
      setFile(new File([data.csv], name, { type: "text/csv" }));
      setPullNote(
        `${data.rowCount} ads pulled${data.truncated ? " (capped)" : ""} · attribution matches Ads Manager`
      );
    } catch {
      setPullError("Network error — check your connection and try again.");
    } finally {
      setPulling(false);
    }
  };

  if (status !== "connected") {
    const disabled =
      status === "connecting" || (config.checked && !config.configured);
    return (
      <div>
        <button
          type="button"
          onClick={connect}
          disabled={disabled}
          className={`w-full cursor-pointer ${btnSecondaryMd}`}
        >
          <ZapIcon className="h-4 w-4 text-blue-700" />
          {status === "connecting"
            ? "Waiting for Meta sign-in…"
            : "Connect Meta account"}
        </button>
        <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-zinc-400">
          READ-ONLY (ADS_READ) · TOKEN HELD IN MEMORY, GONE ON REFRESH
        </p>
        {config.checked && !config.configured && (
          <div
            role="alert"
            className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
          >
            <p className="text-xs leading-relaxed text-amber-800">
              {config.message}
            </p>
            {config.redirectUri && (
              <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-amber-700/70">
                OAUTH REDIRECT · {config.redirectUri}
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs leading-relaxed text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`${cardCompact} p-3.5`}>
      {/* Connected header: live status dot + identity + disconnect. */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/50 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Meta connected · read-only
        </p>
        <button
          type="button"
          onClick={disconnect}
          className="cursor-pointer rounded-sm text-xs font-medium text-zinc-500 transition hover:text-zinc-900 active:text-zinc-700"
        >
          Disconnect
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label htmlFor="meta-account" className="sr-only">
            Ad account
          </label>
          <select
            id="meta-account"
            value={selectedAccount?.id ?? ""}
            onChange={(e) => setAccountId(e.target.value)}
            className={`${inputBase} cursor-pointer`}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="meta-range" className="sr-only">
            Date range
          </label>
          <select
            id="meta-range"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className={`${inputBase} cursor-pointer`}
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {DATE_PRESET_LABELS[preset]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void pull()}
        disabled={pulling || !selectedAccount}
        className={`mt-2.5 w-full cursor-pointer ${btnSecondaryMd}`}
      >
        <RefreshIcon
          className={`h-4 w-4 text-blue-700 ${pulling ? "motion-safe:animate-spin" : ""}`}
        />
        {pulling ? "Pulling ads…" : "Pull ads into the generator"}
      </button>

      {pullNote && (
        <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-wide text-blue-800/80">
          {pullNote.toUpperCase()}
        </p>
      )}
      {pullEmpty && (
        <p
          role="status"
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800"
        >
          No ads found for this account/date range. Try a longer date range,
          upload a CSV, or use sample data.
        </p>
      )}
      {pullError && (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-red-700">
          {pullError}
        </p>
      )}

      <p className="mt-2.5 border-t border-zinc-200/70 pt-2 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-zinc-400">
        TOKEN IN MEMORY ONLY · GONE ON REFRESH
      </p>
    </div>
  );
}
