/**
 * White-label Report Customization V1A — shared types, the fixed
 * accent palette, and pure default/reset logic. No React import here
 * on purpose: this file is unit-testable in plain Node (this repo's
 * script tests can't import React-hook code or JSX). The stateful
 * wrapper (useState, logo object-URL lifecycle) lives in
 * useReportCustomization.ts, which imports from here.
 *
 * Scope reminder (V1A, not the full spec): one agency logo only (no
 * client logo), no cover page, no page numbers, no saved presets, no
 * localStorage/sessionStorage — customization is session-only, held
 * in React state, gone on refresh, exactly like every other piece of
 * report state in this app (see DebriefProvider.tsx's own "refresh
 * wipes, by design" doc comment).
 */

export type ReportMode = "client" | "internal";

export type AccentId = "cyan" | "cobalt" | "violet" | "slate";

export interface AccentDefinition {
  id: AccentId;
  label: string;
  /** --color-accent equivalent — on-screen fills/icons/badges. */
  screen: string;
  /** --color-accent-soft equivalent — on-screen secondary/soft text. */
  screenSoft: string;
  /** --report-accent-print — the ONE print-safe ink color; must read
   *  clearly in color and survive grayscale desaturation as a visible
   *  mid-gray (same principle as the existing hardcoded print accent
   *  this replaces — see app/globals.css). */
  print: string;
}

/**
 * Deliberately NOT free-form: four curated, print-safe options.
 * Deliberately clear of emerald/red/amber — those are reserved for
 * win/loss/warning semantics everywhere else in this app (see
 * components/ui/theme.ts's own header comment) and must never be
 * reachable via this palette.
 */
export const ACCENT_PALETTE: readonly AccentDefinition[] = [
  { id: "cyan", label: "Icy Cyan", screen: "#38bdf8", screenSoft: "#7dd3fc", print: "#0e7490" },
  { id: "cobalt", label: "Cobalt Blue", screen: "#60a5fa", screenSoft: "#93c5fd", print: "#1d4ed8" },
  { id: "violet", label: "Violet", screen: "#a78bfa", screenSoft: "#c4b5fd", print: "#6d28d9" },
  { id: "slate", label: "Slate", screen: "#94a3b8", screenSoft: "#cbd5e1", print: "#334155" },
];

/** The existing on-screen (#38bdf8/#7dd3fc) and print (#0e7490) values
 *  this app already ships — "cyan" MUST stay byte-identical to today's
 *  hardcoded values so the unmodified/default case is provably
 *  unchanged, not just "close." */
export const DEFAULT_ACCENT_ID: AccentId = "cyan";

export function getAccentById(id: AccentId): AccentDefinition {
  return ACCENT_PALETTE.find((a) => a.id === id) ?? ACCENT_PALETTE[0];
}

/** Plain string-keyed object, not React.CSSProperties — keeps this
 *  file free of any React import. Callers spread this into a `style`
 *  prop (React accepts arbitrary custom-property keys in `style`
 *  objects at runtime; the CSSProperties cast happens at the call
 *  site, a one-line concern, not this module's). */
export function accentCssVars(accent: AccentDefinition): Record<string, string> {
  return {
    "--color-accent": accent.screen,
    "--color-accent-soft": accent.screenSoft,
    "--report-accent-print": accent.print,
  };
}

export interface LogoAsset {
  /** Object URL (URL.createObjectURL) — never a data URL, never sent
   *  anywhere. See useReportCustomization.ts for the create/revoke
   *  lifecycle. */
  url: string;
  /** Original filename — used for alt text and the picker's own
   *  "replace/remove" UI, never displayed as report content. */
  name: string;
}

/**
 * Report Foundation V1 — the named starting points a report can be set
 * to. Generic and report-type-agnostic on purpose: which concrete
 * section snapshot each id maps to is defined per report type (e.g.
 * components/debrief/reportPresets.ts for Performance), never here —
 * this file must stay free of any Performance/Competitor-specific
 * knowledge, since it's shared by both report types (see
 * useReportCustomization.ts's optional `presets` argument). "custom" is
 * never a selectable snapshot — it's the derived state when the current
 * presentation fields don't match any named preset.
 */
export type PresetId = "buyer" | "client" | "executive" | "print" | "custom";

/** The presentation-only fields a named preset fixes. Deliberately
 *  EXCLUDES `mode`: applying a preset sets a starting mode, but
 *  afterward switching Buyer/Client is treated as previewing the other
 *  register, not customization — it must never flip a named preset to
 *  "custom" (see matchesPreset). Also excludes every identity/branding
 *  field (agencyName, clientName, reportTitle, agencyLogo, accentId,
 *  dateOverride) for the same reason: those are the user's own inputs,
 *  not "which parts of the report are shown." */
export interface PresetSnapshot<SectionId extends string> {
  sections: Record<SectionId, boolean>;
  topAdsShown: TopAdsShown;
  density: Density;
  colorMode: ColorMode;
}

/** The starting mode a preset applies the moment it's selected — kept
 *  separate from PresetSnapshot because mode is excluded from the
 *  "still matches this preset" check (see above). */
export interface PresetDefinition<SectionId extends string> extends PresetSnapshot<SectionId> {
  mode: ReportMode;
}

export type TopAdsShown = 3 | 5;
export type Density = "compact" | "standard";
export type ColorMode = "color" | "grayscale";

export interface ReportCustomization<SectionId extends string> {
  agencyName: string;
  clientName: string;
  /** "" = use the report's own default title (memo.scope.product /
   *  debrief.competitorName) — never rendered as a literal empty
   *  string. */
  reportTitle: string;
  /** V1A: agency logo only — see the module doc comment. */
  agencyLogo: LogoAsset | null;
  accentId: AccentId;
  /** ISO date string (yyyy-mm-dd) or null — null means "use the
   *  generated date," matching today's default rendering exactly. */
  dateOverride: string | null;
  mode: ReportMode;
  sections: Record<SectionId, boolean>;
  /** Report Foundation V1. Which of the 3 always-shown ad rows to show
   *  per winners/losers list — used identically by the Buyer report,
   *  Client report, and TXT export (see memoToText.ts). Deliberately no
   *  "all" option: the engine itself never computes more than 5
   *  winners/losers (analysis.ts's MAX_WINNERS_LOSERS), so "all" would
   *  be indistinguishable from "5" while implying something untrue. */
  topAdsShown: TopAdsShown;
  /** "compact" hides secondary row sub-lines (the reason/creative-format
   *  note and the conversion-count line) while keeping the primary ad
   *  name, KPI value, vs-median delta, and spend — never a second
   *  layout system, never a change to what the engine generated. */
  density: Density;
  /** Report Foundation V1: an internal, preset-scoped field only — NOT
   *  a user-facing control. The Print-friendly preset sets this to
   *  "grayscale" so it still participates in preset matching
   *  (derivePreset/matchesPreset), but nothing renders it as an
   *  on-screen preview and there is no direct setter for it (removed —
   *  a rough color-flatten mirror read as an unfinished print-CSS
   *  preview rather than a polished theme). Printing itself is
   *  unaffected either way: Print / Save PDF always uses the existing
   *  @media print stylesheet, which this field has never touched. */
  colorMode: ColorMode;
  /** Derived, not independently settable — see derivePreset. Tracks
   *  which named preset (if any) the current presentation fields still
   *  match; "custom" once any of them diverge. */
  preset: PresetId;
}

export function createDefaultSections<Id extends string>(ids: readonly Id[]): Record<Id, boolean> {
  const result = {} as Record<Id, boolean>;
  for (const id of ids) result[id] = true;
  return result;
}

/**
 * The exact default state — every field matches today's pre-feature
 * behavior with zero divergence: no identity overrides, no logo, the
 * existing default accent, no date override, "internal" mode (matches
 * Report.tsx's existing `useState<ReportView>("buyer")` default), and
 * every section visible. Opening the report and never touching the
 * customization panel must be indistinguishable from this object.
 */
export function createDefaultCustomization<Id extends string>(
  ids: readonly Id[]
): ReportCustomization<Id> {
  return {
    agencyName: "",
    clientName: "",
    reportTitle: "",
    agencyLogo: null,
    accentId: DEFAULT_ACCENT_ID,
    dateOverride: null,
    mode: "internal",
    sections: createDefaultSections(ids),
    topAdsShown: 5,
    density: "standard",
    colorMode: "color",
    /* Placeholder — useReportCustomization's initializer immediately
       recomputes this via derivePreset() against whatever preset table
       (if any) the caller supplied. Kept here only so this function
       returns a complete, independently-usable ReportCustomization on
       its own (as the existing tests already call it directly). */
    preset: "custom",
  };
}

/**
 * Report Foundation V1 — does `customization` still match `snapshot`
 * exactly? Compares ONLY the presentation fields a preset defines
 * (sections/topAdsShown/density/colorMode) — deliberately NEVER `mode`
 * (previewing the other register doesn't "leave" a preset) and NEVER
 * any identity/branding field (those aren't part of what a preset
 * means). Pure — no state, safe to call on every render.
 */
export function matchesPreset<Id extends string>(
  customization: ReportCustomization<Id>,
  snapshot: PresetSnapshot<Id>,
  ids: readonly Id[]
): boolean {
  if (
    customization.topAdsShown !== snapshot.topAdsShown ||
    customization.density !== snapshot.density ||
    customization.colorMode !== snapshot.colorMode
  ) {
    return false;
  }
  return ids.every((id) => customization.sections[id] === snapshot.sections[id]);
}

/**
 * The single source of truth for "which named preset (if any) does the
 * current state match" — the ONLY place this is decided. Every setter
 * that touches a presentation field calls this after applying its own
 * change, rather than tracking "is this still Custom?" ad hoc per
 * setter. Checked in a fixed order; the first match wins (the four
 * presets are constructed to never overlap, so order is a tie-breaker
 * in principle only). `presets` is undefined for report types with no
 * defined presets yet (Competitor Debrief, this milestone) — in that
 * case this always returns "custom", harmlessly.
 */
export function derivePreset<Id extends string>(
  customization: ReportCustomization<Id>,
  presets: Partial<Record<Exclude<PresetId, "custom">, PresetSnapshot<Id>>> | undefined,
  ids: readonly Id[]
): PresetId {
  if (!presets) return "custom";
  const order: Exclude<PresetId, "custom">[] = ["buyer", "client", "executive", "print"];
  for (const id of order) {
    const snapshot = presets[id];
    if (snapshot && matchesPreset(customization, snapshot, ids)) return id;
  }
  return "custom";
}

/**
 * Section visibility a "Client-ready" mode recommends, computed on
 * demand: every section visible for "internal", the given
 * hiddenInClientMode ids hidden for "client".
 *
 * Report Foundation V1: no longer called by setMode. Applying a preset
 * (setPreset) is now the one mechanism that sets mode + sections
 * together; switching Buyer/Client afterward changes only the register
 * (see useReportCustomization.ts's setMode and approved decision #9).
 * Kept exported and tested as a standalone pure utility — still
 * correct, just no longer wired into the mode toggle.
 */
export function applyModeDefaults<Id extends string>(
  ids: readonly Id[],
  mode: ReportMode,
  hiddenInClientMode: readonly Id[]
): Record<Id, boolean> {
  const sections = createDefaultSections(ids);
  if (mode === "client") {
    for (const id of hiddenInClientMode) sections[id] = false;
  }
  return sections;
}
