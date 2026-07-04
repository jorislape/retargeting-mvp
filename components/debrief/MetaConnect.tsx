"use client";

import { useState } from "react";
import type { DatePreset } from "@/modules/meta/types";
import { DATE_PRESET_LABELS, DATE_PRESETS } from "@/modules/meta/types";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { useMeta } from "@/components/workspace/MetaProvider";
import { RefreshIcon, ZapIcon } from "@/components/ui/icons";
import { btnSecondaryMd, inputBase } from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* The second way into the pipeline: connect Meta read-only, pull      */
/* ad-level insights, and drop them into the generator as a "virtual   */
/* CSV" File. From that point on the flow is identical to an upload —  */
/* the engine never knows the difference.                              */
/* ------------------------------------------------------------------ */

export function MetaConnect() {
  const { status, accounts, token, error, connect, disconnect, expire } =
    useMeta();
  const { setFile } = useDebrief();

  const [accountId, setAccountId] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullNote, setPullNote] = useState<string | null>(null);

  const selectedAccount =
    accounts.find((a) => a.id === accountId) ?? accounts[0] ?? null;

  const pull = async () => {
    if (!token || !selectedAccount) return;
    setPulling(true);
    setPullError(null);
    setPullNote(null);
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
    return (
      <div>
        <button
          type="button"
          onClick={connect}
          disabled={status === "connecting"}
          className={`w-full cursor-pointer ${btnSecondaryMd}`}
        >
          <ZapIcon className="h-4 w-4 text-blue-300" />
          {status === "connecting"
            ? "Waiting for Meta sign-in…"
            : "Connect Meta account"}
        </button>
        <p className="mt-2 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-zinc-600">
          READ-ONLY (ADS_READ) · TOKEN HELD IN MEMORY, GONE ON REFRESH
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[1fr_auto] gap-2">
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
        className={`w-full cursor-pointer ${btnSecondaryMd}`}
      >
        <RefreshIcon
          className={`h-4 w-4 text-blue-300 ${pulling ? "motion-safe:animate-spin" : ""}`}
        />
        {pulling ? "Pulling ads…" : "Pull ads into the generator"}
      </button>

      {pullNote && (
        <p className="font-mono text-[10px] leading-relaxed tracking-wide text-blue-300/80">
          {pullNote.toUpperCase()}
        </p>
      )}
      {pullError && (
        <p role="alert" className="text-xs leading-relaxed text-red-300">
          {pullError}
        </p>
      )}

      <p className="flex items-baseline justify-between gap-2 font-mono text-[10px] tracking-[0.14em] text-zinc-600">
        CONNECTED · READ-ONLY
        <button
          type="button"
          onClick={disconnect}
          className="cursor-pointer rounded-sm font-sans text-xs font-medium normal-case tracking-normal text-zinc-400 transition hover:text-white"
        >
          Disconnect
        </button>
      </p>
    </div>
  );
}
