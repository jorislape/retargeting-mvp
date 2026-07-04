/* ------------------------------------------------------------------ */
/* Shared class-name constants — the night-desk identity.              */
/* canvas:  carbon (#121110, set in globals) under a low amber haze    */
/*          and a fine masked grid                                     */
/* surface: graphite panels clearly lighter than the canvas, lit from  */
/*          above — 1px warm edge-light + deep drop shadow             */
/* wells:   inputs/data cells recess BELOW the panel (bg-well)         */
/* accent:  AMBER is the one signal color — solid amber with dark      */
/*          text is a real action; amber tint is a state              */
/* emerald/red: reserved exclusively for win/loss semantics            */
/* neutrals: warm (stone), never cool (zinc/slate)                     */
/*                                                                     */
/* Every interactive constant carries all four states: hover,          */
/* focus-visible, active, disabled. Motion is transform/opacity only   */
/* and gated behind motion-safe.                                       */
/* ------------------------------------------------------------------ */

/* Panel card: a visible graphite surface, not a border-only
   rectangle. Gradient runs darker toward the bottom and the top edge
   catches the lamp — the warm "lit edge" that separates panel from
   canvas at a glance. */
export const card =
  "rounded-xl border border-white/10 bg-gradient-to-b from-[#201e1a] to-[#171512] shadow-[0_20px_48px_-16px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(253,230,138,0.07)]";

/* Border lightens on hover — no bg shift, no lift. */
export const cardHover = "transition hover:border-white/20";

/* Interactive tile: the card material plus a gentle lift. For tiles a
   pointer can rest on (steps, sections) — not for data panels. */
export const cardLift =
  "transition motion-safe:duration-200 hover:border-white/20 hover:shadow-[0_24px_56px_-16px_rgba(0,0,0,0.85),0_0_24px_-10px_rgba(251,191,36,0.15),inset_0_1px_0_rgba(253,230,138,0.10)] motion-safe:hover:-translate-y-0.5";

/* Compact card: same material at higher density — inner edge light
   only, no drop shadow (stacked shadows read bulky in grids). */
export const cardCompact =
  "rounded-lg border border-white/10 bg-gradient-to-b from-[#1d1b18] to-[#171512] shadow-[inset_0_1px_0_rgba(253,230,138,0.06)]";

/* Primary action: solid amber, dark text — the terminal's hot key. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-stone-950 shadow-[0_2px_12px_-2px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-3.5 py-2 text-sm font-semibold text-stone-950 shadow-[0_2px_10px_-2px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:bg-amber-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60";

/* Page-level secondary action: same material, 44px touch target. */
export const btnSecondaryMd =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60";

export const textLink =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-stone-400 transition hover:text-white active:text-stone-300";

/* Eyebrows/data labels are mono — the terminal register. */
export const eyebrow =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500";

/* Inputs recess below the panel surface: darker than the card, inner
   shadow, border wakes on hover, amber only on focus. */
export const inputBase =
  "w-full rounded-lg border border-white/10 bg-well px-3 py-2 text-sm text-stone-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)] transition-colors placeholder:text-stone-600 hover:border-white/20 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldLabel =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500";

/* Amber-clipped key phrase for a page h1 (one per page, max).
   Hand-rolled class in globals.css for the Safari prefix. */
export const gradientText = "gradient-phrase";

/* Icon chip for section tiles: graphite well, amber icon. */
export const iconChip =
  "flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

/* The KPI/topic chip — amber signal tint (a state, not an action). */
export const chipBlue =
  "inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300";

export const chipEmerald =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300";

export const chipAmber =
  "inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300";

export const chipNeutral =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-stone-400";

export const chipRed =
  "inline-flex items-center gap-1.5 rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-300";

/* Skeletons mimic the card material they stand in for. */
export const skeletonTile =
  "h-20 animate-pulse rounded-lg border border-white/10 bg-[#1a1815]";

export const skeletonPanel =
  "animate-pulse rounded-xl border border-white/10 bg-[#1a1815]";
