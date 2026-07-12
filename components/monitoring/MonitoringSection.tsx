"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompetitorView } from "@/modules/monitoring/service";
import { getWatchlistSnapshot } from "@/modules/competitor";
import { badgeAccent, badgeMuted, btnSecondary, inputBase } from "@/components/ui/theme";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import { deriveMonitoringStatus, formatNextCheck } from "./status";
import {
  BETA_TAGLINE,
  BETA_TITLE,
  BETA_WARNING_LINES,
  EMPTY_STATE_EXPLANATION,
  GENERATOR_VS_MONITORING_LINE,
  MONITORING_ACTIVE_LINE,
  MONITORING_BACKGROUND_LINE,
  PAUSED_NOTE,
  retainedSnapshotNote,
  UNAVAILABLE_MESSAGE,
  WEBSITE_ONLY_HELPER,
  WORKSPACE_OWNERSHIP_LINE,
} from "./copy";

/**
 * Competitor Monitoring Beta — the whole client surface, in one
 * self-contained component (wrapped by MonitoringErrorBoundary at the
 * mount point). Talks ONLY to /api/monitoring/* routes; imports no
 * server/database code (outcomes.ts is a pure vocabulary module).
 *
 * Flag-off deployments return {disabled:true} from the API and this
 * renders NOTHING — the section is invisible, not merely inert.
 * Infrastructure failures render the honest inline unavailable card.
 * A workspace exists only after the user adds the first URL (that
 * request mints the anonymous-workspace cookie).
 */

type ApiCompetitor = CompetitorView;

type SectionState =
  | { phase: "loading" }
  | { phase: "hidden" } // flag off
  | { phase: "unavailable" }
  | { phase: "ready"; competitors: ApiCompetitor[]; maxPerWorkspace: number };

const fmtTime = (iso: string | null): string =>
  iso === null ? "never" : new Date(iso).toLocaleString();

export function MonitoringSection() {
  const [state, setState] = useState<SectionState>({ phase: "loading" });
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // action key
  const [notice, setNotice] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/competitors", {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.disabled === true) {
        setState({ phase: "hidden" });
      } else if (data.ok === true) {
        setState({
          phase: "ready",
          competitors: data.competitors ?? [],
          maxPerWorkspace: data.maxPerWorkspace ?? 3,
        });
      } else {
        setState({ phase: "unavailable" });
      }
    } catch {
      setState({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (state.phase === "hidden") return null;
  if (state.phase === "loading") return null;

  if (state.phase === "unavailable") {
    return (
      <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2.5 text-xs leading-relaxed text-amber-200">
        {UNAVAILABLE_MESSAGE}
      </p>
    );
  }

  const { competitors, maxPerWorkspace } = state;
  const atCap = competitors.length >= maxPerWorkspace;

  const act = async (key: string, run: () => Promise<Response>) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await run();
      const data = await res.json().catch(() => ({}));
      if (data.ok !== true && typeof data.message === "string") {
        setNotice(data.message);
      } else if (data.ok !== true) {
        setNotice(UNAVAILABLE_MESSAGE);
      }
      await refresh();
    } catch {
      setNotice(UNAVAILABLE_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  const addUrl = (raw: string) =>
    act("add", () =>
      fetch("/api/monitoring/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      })
    );

  /** The add action for both the button click and the Enter key —
   *  same guard as the old form's onSubmit. */
  const submitUrl = () => {
    if (url.trim() !== "" && busy === null) {
      void addUrl(url.trim()).then(() => setUrl(""));
    }
  };

  /** One-way import: COPIES a saved watchlist URL into monitoring.
   *  The localStorage watchlist itself is never modified. */
  const importable = getWatchlistSnapshot().filter(
    (w) =>
      w.url.trim() !== "" &&
      !competitors.some((c) => c.url === w.url.trim())
  );

  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
      {/* Collapsed by default: a compact heading + tagline + expand
          affordance, NOT the full warning wall — opening the shared
          competitor/market block for reasons A/B/C must never force a
          read-through of beta terms nobody asked about. Auto-opens
          (and stays open across renders, same `open={condition}`
          pattern used elsewhere in GeneratorPanel) once the workspace
          already has monitored competitors, so a returning user sees
          their statuses with no extra click. Whether it opens on its
          own or by a click, the FULL 5-line warning below always
          renders before the URL input, every time — nothing here
          shortcuts that disclosure, satisfying the fence requirement
          that the warning is shown before enabling and on the section. */}
      <details open={competitors.length > 0}>
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
          <span className="text-[13px] font-semibold tracking-tight text-zinc-100">
            {BETA_TITLE}
          </span>
          <span className={badgeAccent}>Beta</span>
          <span className="text-xs text-zinc-400">{BETA_TAGLINE}</span>
          {competitors.length === 0 && (
            <span className="ml-auto shrink-0 text-xs font-medium text-accent-soft">
              Set up →
            </span>
          )}
        </summary>

        <div className="mt-3">
      {/* The beta warning stays visible whenever this is open — it IS the deal. */}
      <ul className="space-y-1 text-xs leading-relaxed text-zinc-400">
        {BETA_WARNING_LINES.map((line) => (
          <li key={line} className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600"
            />
            {line}
          </li>
        ))}
      </ul>

      {/* Empty state explains what happens after adding a URL (no
          competitors yet); once monitoring is actually running, the
          same slot instead confirms it's active, runs in the
          background, and explains workspace ownership — so a user
          never has to infer either fact. */}
      {competitors.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          {EMPTY_STATE_EXPLANATION}
        </p>
      ) : (
        <div className="mt-3 space-y-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
          <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
            <span
              aria-hidden="true"
              className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
            />
            {MONITORING_ACTIVE_LINE}
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            {MONITORING_BACKGROUND_LINE}
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            {WORKSPACE_OWNERSHIP_LINE}
          </p>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            {GENERATOR_VS_MONITORING_LINE}
          </p>
        </div>
      )}

      {/* Add row (hidden at cap). Adding the FIRST page is what
          creates the anonymous workspace + cookie.
          NOT a <form>, deliberately: this section is mounted inside
          GeneratorPanel's page-wide <form>, and a nested <form> is
          invalid HTML with undefined submit routing — it caused native
          full-page reloads on submit in production. No monitoring
          component may render <form> or a submit-typed button
          (regression-tested in scripts/monitoring-isolation.test.ts);
          Enter is handled explicitly below so it adds the competitor
          instead of falling through to the outer generator form. */}
      {!atCap && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="monitor-url" className="sr-only">
              Competitor page URL to monitor
            </label>
            <input
              id="monitor-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // never reach the outer form
                  submitUrl();
                }
              }}
              placeholder="https://competitor.com/landing"
              className={`min-w-0 flex-1 ${inputBase}`}
            />
            <button
              type="button"
              onClick={submitUrl}
              disabled={busy !== null || url.trim() === ""}
              className={`cursor-pointer ${btnSecondary}`}
            >
              {busy === "add" ? "Adding…" : "Monitor weekly"}
            </button>
            {importable.length > 0 && (
              <button
                type="button"
                onClick={() => setShowImport((v) => !v)}
                className="cursor-pointer rounded-sm text-xs font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Import from watchlist
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
            {WEBSITE_ONLY_HELPER}
          </p>
        </div>
      )}
      {atCap && (
        <p className="mt-3 text-xs text-zinc-400">
          Monitoring {maxPerWorkspace} of {maxPerWorkspace} pages — the beta
          cap. Remove one to add another.
        </p>
      )}

      {/* One-way watchlist import: copy only, never deletes. */}
      {showImport && importable.length > 0 && !atCap && (
        <div className="mt-2 space-y-1.5">
          {importable.map((w) => (
            <div key={w.url} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">
                {w.url.trim()}
              </span>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void addUrl(w.url.trim())}
                className={`cursor-pointer ${btnSecondary}`}
              >
                Copy into monitoring
              </button>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Copies the URL only — your browser watchlist is unchanged.
          </p>
        </div>
      )}

      {notice && (
        <p
          aria-live="polite"
          className="mt-2 text-xs leading-relaxed text-amber-300"
        >
          {notice}
        </p>
      )}

      {/* Monitored pages */}
      {competitors.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {competitors.map((c) => {
            const status = deriveMonitoringStatus(c.paused, c.lastOutcome);
            const retainedSnapshotAt = c.lastSuccessAt ?? c.latest?.fetchedAt ?? null;
            return (
              <div
                key={c.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-200">
                    {c.url}
                  </p>
                  <span className={status.tone === "accent" ? badgeAccent : badgeMuted}>
                    {status.label}
                  </span>
                  {c.meaningfulChange && (
                    <span className={badgeAccent}>Changed</span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                  Last successful check: {fmtTime(c.lastSuccessAt)} · Last
                  attempt: {fmtTime(c.lastAttemptAt)}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                  Next check: {formatNextCheck(c.nextCheckAt, new Date())}
                </p>
                {status.note && (
                  <p
                    className={`mt-1 text-[11px] leading-relaxed ${
                      status.isFailure ? "text-amber-300" : "text-zinc-400"
                    }`}
                  >
                    {status.note}
                  </p>
                )}
                {status.isFailure && retainedSnapshotAt && (
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                    {retainedSnapshotNote(retainedSnapshotAt)}
                  </p>
                )}
                {c.paused && (
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-300">
                    {PAUSED_NOTE}
                  </p>
                )}
                {c.changes !== null && c.changes.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-zinc-400">
                    {c.changes.map((line) => (
                      <li key={line} className="flex gap-1.5">
                        <CheckIcon className="mt-0.5 h-3 w-3 shrink-0 text-accent-soft" />
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void act(`retry-${c.id}`, () =>
                        fetch(`/api/monitoring/competitors/${c.id}/retry`, {
                          method: "POST",
                        })
                      )
                    }
                    className={`cursor-pointer ${btnSecondary}`}
                  >
                    {busy === `retry-${c.id}` ? "Checking…" : "Retry now"}
                  </button>
                  {c.paused && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(`resume-${c.id}`, () =>
                          fetch(`/api/monitoring/competitors/${c.id}/resume`, {
                            method: "POST",
                          })
                        )
                      }
                      className={`cursor-pointer ${btnSecondary}`}
                    >
                      Resume
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      void act(`remove-${c.id}`, () =>
                        fetch(`/api/monitoring/competitors/${c.id}`, {
                          method: "DELETE",
                        })
                      )
                    }
                    className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <XIcon className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      </details>
    </div>
  );
}
