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
  };
}

/**
 * Section visibility a "Client-ready" mode switch recommends — a
 * one-time starting point applied at the moment mode changes, not a
 * standing rule re-applied on every render (the user's own manual
 * toggle edits after switching modes are never silently overwritten
 * — see useReportCustomization.ts's setMode). Switching back to
 * "Internal buyer" resets every section back to visible, mirroring
 * "Internal buyer" being the all-visible default state.
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
