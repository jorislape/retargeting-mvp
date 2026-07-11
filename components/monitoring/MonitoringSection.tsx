"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompetitorView } from "@/modules/monitoring/service";
import { OUTCOME_LABELS } from "@/modules/monitoring/outcomes";
import { getWatchlistSnapshot } from "@/modules/competitor";
import { badgeAccent, badgeMuted, btnSecondary, inputBase } from "@/components/ui/theme";
import { CheckIcon, XIcon } from "@/components/ui/icons";
import {
  BETA_TAGLINE,
  BETA_TITLE,
  BETA_WARNING_LINES,
  PAUSED_NOTE,
  UNAVAILABLE_MESSAGE,
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

  /** One-way import: COPIES a saved watchlist URL into monitoring.
   *  The localStorage watchlist itself is never modified. */
  const importable = getWatchlistSnapshot().filter(
    (w) =>
      w.url.trim() !== "" &&
      !competitors.some((c) => c.url === w.url.trim())
  );

  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[13px] font-semibold tracking-tight text-zinc-100">
          {BETA_TITLE}
        </p>
        <span className={badgeAccent}>Beta</span>
        <span className="text-xs text-zinc-400">{BETA_TAGLINE}</span>
      </div>

      {/* The beta warning stays visible — it IS the deal. */}
      <ul className="mt-2.5 space-y-1 text-xs leading-relaxed text-zinc-400">
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

      {/* Add form (hidden at cap). Adding the FIRST page is what
          creates the anonymous workspace + cookie. */}
      {!atCap && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() !== "" && busy === null) {
              void addUrl(url.trim()).then(() => setUrl(""));
            }
          }}
        >
          <label htmlFor="monitor-url" className="sr-only">
            Competitor page URL to monitor
          </label>
          <input
            id="monitor-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://competitor.com/landing"
            className={`min-w-0 flex-1 ${inputBase}`}
          />
          <button
            type="submit"
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
        </form>
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
            const status = c.paused
              ? "Paused"
              : c.lastOutcome === null
                ? "First check pending (runs daily)"
                : OUTCOME_LABELS[c.lastOutcome];
            return (
              <div
                key={c.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-200">
                    {c.url}
                  </p>
                  <span className={c.paused ? badgeMuted : badgeAccent}>
                    {status}
                  </span>
                  {c.meaningfulChange && (
                    <span className={badgeAccent}>Changed</span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                  Last successful check: {fmtTime(c.lastSuccessAt)} · Last
                  attempt: {fmtTime(c.lastAttemptAt)}
                </p>
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
  );
}
