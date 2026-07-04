/* ------------------------------------------------------------------ */
/* Shared class-name constants — the ink-on-paper identity.            */
/* canvas:  paper (#f4f4f2, set in globals) under a faint cool         */
/*          spotlight and a graph-paper whisper                        */
/* surface: white cards with hairline zinc borders and soft, short     */
/*          shadows — a sheet resting on the desk, never floating      */
/* ink:     near-black is the primary action color (solid ink          */
/*          buttons); cobalt (blue-700) is reserved for focus, links,  */
/*          and active markers                                         */
/* emerald/red: reserved exclusively for win/loss semantics            */
/*                                                                     */
/* Affordance rule: SOLID ink = a real, clickable action; a tinted     */
/* zinc/blue fill = a state (active nav item, selected pill).          */
/* Every interactive constant carries all four states: hover,          */
/* focus-visible, active, disabled. Motion is transform/opacity only   */
/* and gated behind motion-safe.                                       */
/* ------------------------------------------------------------------ */

/* Panel card: a white sheet with a hairline edge and a short, soft
   shadow. Depth comes from the border + shadow pair, not darkness. */
export const card =
  "rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(23,25,29,0.04),0_8px_24px_-16px_rgba(23,25,29,0.10)]";

/* Border deepens on hover — no bg shift, no lift. */
export const cardHover = "transition hover:border-zinc-300";

/* Interactive tile: the card material plus a gentle lift. For tiles a
   pointer can rest on (steps, sections) — not for data panels. */
export const cardLift =
  "transition motion-safe:duration-200 hover:border-zinc-300 hover:shadow-[0_2px_4px_rgba(23,25,29,0.05),0_16px_32px_-16px_rgba(23,25,29,0.14)] motion-safe:hover:-translate-y-0.5";

/* Compact card: same material at higher density — hairline only,
   minimal shadow (stacked shadows read bulky in grids). */
export const cardCompact =
  "rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(23,25,29,0.04)]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(23,25,29,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(23,25,29,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(23,25,29,0.05)] transition hover:border-zinc-400 hover:text-zinc-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/60";

/* Page-level secondary action: same material, 44px touch target. */
export const btnSecondaryMd =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(23,25,29,0.05)] transition hover:border-zinc-400 hover:text-zinc-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/60";

export const textLink =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-zinc-600 transition hover:text-zinc-900 active:text-zinc-700";

/* Eyebrows/data labels are mono — the working-document register. */
export const eyebrow =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

/* Inputs sit flush with the sheet: white, hairline border, focus goes
   cobalt. */
export const inputBase =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-[inset_0_1px_2px_rgba(23,25,29,0.04)] transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60";

export const fieldLabel =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

/* Key phrase of a page h1 (one per page, max) — solid ink-blue, no
   gradient. Class defined in globals.css; name kept for callers. */
export const gradientText = "gradient-phrase";

/* Icon chip for section tiles: quiet zinc well, ink icon. */
export const iconChip =
  "flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700";

export const chipBlue =
  "inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-800";

export const chipEmerald =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800";

export const chipAmber =
  "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800";

export const chipNeutral =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600";

export const chipRed =
  "inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-800";

/* Skeletons mimic the card material they stand in for. */
export const skeletonTile =
  "h-20 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100";

export const skeletonPanel =
  "animate-pulse rounded-xl border border-zinc-200 bg-zinc-100";
