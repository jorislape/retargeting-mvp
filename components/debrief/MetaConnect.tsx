"use client";

import { useEffect, useState } from "react";
import type { DatePreset } from "@/modules/meta/types";
import { DATE_PRESET_LABELS, DATE_PRESETS } from "@/modules/meta/types";
import type { KpiKey } from "@/modules/debrief";
import {
  extractAds,
  KPI_LABELS,
  parseCsv,
  requiredColumnsFor,
  resolveColumns,
  toTable,
} from "@/modules/debrief";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { useMeta } from "@/components/workspace/MetaProvider";
import { RefreshIcon, ZapIcon } from "@/components/ui/icons";
import { btnSecondary, btnSecondaryMd, inputBase } from "@/components/ui/theme";

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

const KPI_KEYS: KpiKey[] = ["roas", "cpa", "ctr", "cpc", "leads", "purchases"];

/** Which KPIs the pulled virtual CSV actually carries DATA for — the
 *  Meta export always ships every column, so column presence alone
 *  can't tell an account that never tracked purchases from one that
 *  did. Runs the same client-safe engine helpers the preview uses;
 *  display-only, no analysis. */
function kpisWithData(csvText: string): KpiKey[] {
  const { headers, rows } = toTable(parseCsv(csvText));
  const columns = resolveColumns(headers);
  return KPI_KEYS.filter(
    (kpi) =>
      requiredColumnsFor(kpi, columns).length === 0 &&
      extractAds(rows, columns, kpi).some((ad) => ad.kpiValue != null)
  );
}

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
  const { fields, setFile } = useDebrief();
  const config = useMetaConfig();

  const [accountId, setAccountId] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullNote, setPullNote] = useState<string | null>(null);
  const [pullEmpty, setPullEmpty] = useState(false);
  /** Set when the pull succeeded but the currently-selected KPI has no
   *  data in the pulled rows — guidance toward a KPI that does. */
  const [kpiNote, setKpiNote] = useState<string | null>(null);
  /** DEV-ONLY diagnostic: copy the in-memory token to the clipboard for
   *  manual API testing (e.g. verifying Ad Library API access outside
   *  this app). NODE_ENV is safe to gate on HERE specifically because
   *  this is a client component — Next.js inlines the check at build
   *  time and strips the branch from any `next build` output (which is
   *  what every deployed environment runs, preview or production), so
   *  this can only ever render under local `next dev`. The token never
   *  leaves the browser or touches the server for this — see
   *  MetaProvider's header comment for why that's the invariant to
   *  keep. Remove this block once Ad Library API access is confirmed.
   */
  const [tokenCopied, setTokenCopied] = useState(false);
  const copyTokenForDevTesting = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — no-op; this
      // is a throwaway dev aid, not a feature that needs a fallback.
    }
  };

  const selectedAccount =
    accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;

  const pull = async () => {
    if (!token || !selectedAccount) return;
    setPulling(true);
    setPullError(null);
    setPullNote(null);
    setPullEmpty(false);
    setKpiNote(null);
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
      /* Meta always ships every column, so check for DATA: if the
         selected KPI has none in this pull, say so and name the KPIs
         that would work — the file stays loaded either way. */
      const available = kpisWithData(data.csv);
      if (!available.includes(fields.kpi)) {
        const alternatives = available.map((k) => KPI_LABELS[k]).join(", ");
        setKpiNote(
          `${KPI_LABELS[fields.kpi]} is not available for this account/date range. Try ${
            alternatives || "a different account or date range"
          }${alternatives ? " if available" : ""}.`
        );
      }
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
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
        <p className="text-sm leading-snug text-zinc-400">
          Pull ad-level insights from Meta instead of uploading a CSV —
          attribution matches Ads Manager.
        </p>
        <button
          type="button"
          onClick={connect}
          disabled={disabled}
          className={`w-full cursor-pointer ${btnSecondaryMd}`}
        >
          <ZapIcon className="h-4 w-4 text-accent-soft" />
          {status === "connecting"
            ? "Waiting for Meta sign-in…"
            : "Connect Meta account"}
        </button>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">
          OAuth · ads_read only · token stays in memory
        </p>
        {config.checked && !config.configured && (
          <div
            role="alert"
            className="border-l-2 border-amber-400/70 bg-amber-400/[0.05] px-3 py-2.5"
          >
            <p className="text-xs leading-relaxed text-amber-200">
              {config.message}
            </p>
            {config.redirectUri && (
              <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-amber-300/60">
                OAUTH REDIRECT · {config.redirectUri}
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs leading-relaxed text-red-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Connected header: live status dot + identity + disconnect. */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
          <span
            aria-hidden="true"
            className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
          />
          Meta connected · read-only
        </p>
        <button
          type="button"
          onClick={disconnect}
          className="cursor-pointer rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white active:text-zinc-300"
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
        className={`mt-2.5 w-full cursor-pointer ${btnSecondary}`}
      >
        <RefreshIcon
          className={`h-3.5 w-3.5 text-zinc-400 ${pulling ? "motion-safe:animate-spin" : ""}`}
        />
        {pulling ? "Pulling ads…" : "Pull ads into the generator"}
      </button>

      {pullNote && (
        <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-wide text-accent-soft/90">
          {pullNote.toUpperCase()}
        </p>
      )}
      {kpiNote && (
        <p
          role="status"
          className="mt-2 border-l-2 border-amber-400/70 bg-amber-400/[0.05] px-3 py-2.5 text-xs leading-relaxed text-amber-200"
        >
          {kpiNote}
        </p>
      )}
      {pullEmpty && (
        <p
          role="status"
          className="mt-2 border-l-2 border-amber-400/70 bg-amber-400/[0.05] px-3 py-2.5 text-xs leading-relaxed text-amber-200"
        >
          No ads found for this account/date range. Try a longer date range,
          upload a CSV, or use sample data.
        </p>
      )}
      {pullError && (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
          {pullError}
        </p>
      )}

      <p className="mt-2.5 border-t border-white/[0.07] pt-2 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-zinc-400">
        TOKEN IN MEMORY ONLY · GONE ON REFRESH
      </p>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-2 border-l-2 border-amber-400/70 bg-amber-400/[0.05] px-3 py-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300">
            Dev only
          </p>
          <button
            type="button"
            onClick={() => void copyTokenForDevTesting()}
            className="mt-1 cursor-pointer text-xs font-medium text-amber-200 underline decoration-amber-400/40 underline-offset-2 hover:text-amber-100"
          >
            {tokenCopied ? "Copied to clipboard" : "Copy access token to clipboard"}
          </button>
        </div>
      )}
    </div>
  );
}
