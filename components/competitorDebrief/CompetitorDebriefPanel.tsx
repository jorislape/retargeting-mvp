"use client";

import { useState } from "react";
import type { CompetitorDebrief, CompetitorDebriefApiError } from "@/modules/competitorDebrief";
import { btnPrimary, card, fieldLabel, inputBase } from "@/components/ui/theme";
import { AlertTriangleIcon, SparklesIcon } from "@/components/ui/icons";
import { CompetitorDebriefResult } from "./CompetitorDebriefResult";

/**
 * Competitor Debrief V1 — a separate, CSV-free flow. One input section,
 * one generate action, no source cards / watchlist / monitoring
 * complexity from the CSV generator. See modules/competitorDebrief for
 * the engine and the truthfulness rules it enforces.
 */

interface FormState {
  competitorName: string;
  adsLibraryUrl: string;
  websiteUrl: string;
  observations: string;
}

const EMPTY_FORM: FormState = {
  competitorName: "",
  adsLibraryUrl: "",
  websiteUrl: "",
  observations: "",
};

export function CompetitorDebriefPanel() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [debrief, setDebrief] = useState<CompetitorDebrief | null>(null);
  const [error, setError] = useState<CompetitorDebriefApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/competitor-debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(
          body?.error ?? {
            title: "Something went wrong",
            message: "The debrief couldn't be generated.",
            fix: "Try again in a moment.",
          }
        );
        setDebrief(null);
        return;
      }
      setDebrief(body.debrief);
    } catch {
      setError({
        title: "Connection issue",
        message: "The request couldn't be completed.",
        fix: "Check your connection and try again.",
      });
      setDebrief(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className={`${card} p-5 sm:p-6`}>
        <div className="mb-1 flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-accent-soft" />
          <h2 className="text-sm font-semibold text-white">Competitor debrief</h2>
        </div>
        <p className="mb-5 text-xs leading-relaxed text-zinc-400">
          Paste what you observed about a competitor&rsquo;s ads (e.g. from the
          Meta Ads Library) and get a structured, directional read: recurring
          hooks, formats, offers, and positioning. This never infers spend,
          conversions, or performance, and it never fetches the Ads Library —
          it only interprets what you paste.
        </p>

        <div className="space-y-4">
          <div>
            <label className={`${fieldLabel} mb-1.5 block`} htmlFor="competitor-name">
              Competitor name
            </label>
            <input
              id="competitor-name"
              type="text"
              autoComplete="off"
              className={inputBase}
              placeholder="e.g. ColonBroom"
              value={form.competitorName}
              onChange={(e) => set("competitorName")(e.target.value)}
            />
          </div>

          <div>
            <label className={`${fieldLabel} mb-1.5 block`} htmlFor="ads-library-url">
              Meta Ads Library URL
            </label>
            <input
              id="ads-library-url"
              type="text"
              autoComplete="off"
              className={inputBase}
              placeholder="https://www.facebook.com/ads/library/?..."
              value={form.adsLibraryUrl}
              onChange={(e) => set("adsLibraryUrl")(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Kept as a source reference only — not fetched by this app.
            </p>
          </div>

          <div>
            <label className={`${fieldLabel} mb-1.5 block`} htmlFor="website-url">
              Website / landing page URL <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              id="website-url"
              type="text"
              autoComplete="off"
              className={inputBase}
              placeholder="https://example.com"
              value={form.websiteUrl}
              onChange={(e) => set("websiteUrl")(e.target.value)}
            />
          </div>

          <div>
            <label className={`${fieldLabel} mb-1.5 block`} htmlFor="observations">
              Ad examples / observations
            </label>
            <textarea
              id="observations"
              rows={7}
              className={`${inputBase} resize-y`}
              placeholder={
                "Paste ad copy, hooks, formats, offers, CTAs, start dates, or general observations you noticed in the Ads Library.\n\ne.g. \"UGC video with a founder-style hook: 'I used to feel bloated every day...'. Offer: 20% off first order + free shipping. CTA: Shop Now. Positioning leans on gut-health/clinical claims.\""
              }
              value={form.observations}
              onChange={(e) => set("observations")(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            className={btnPrimary}
            disabled={loading || form.competitorName.trim() === "" || form.adsLibraryUrl.trim() === "" || form.observations.trim() === ""}
            onClick={handleGenerate}
          >
            {loading ? "Generating…" : "Generate competitor debrief"}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3 text-xs text-red-300">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{error.title}</p>
              <p className="mt-0.5 text-red-300/80">{error.message}</p>
              <p className="mt-0.5 text-red-300/60">{error.fix}</p>
            </div>
          </div>
        )}
      </div>

      {debrief && <CompetitorDebriefResult debrief={debrief} />}
    </div>
  );
}
