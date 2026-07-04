/* ------------------------------------------------------------------ */
/* Shared class-name constants — the "Creative Signal" identity.       */
/* canvas:  carbon (#0a0a0c, set in globals) under a fuchsia signal-   */
/*          haze, a cyan counterweight, and a fine masked grid         */
/* surface: cool graphite panels clearly lighter than the canvas —     */
/*          1px crisp border + cool edge-light + deep drop shadow      */
/* wells:   inputs/data cells recess BELOW the panel (bg-well)         */
/* signal:  fuchsia→pink gradient = a real action; fuchsia tint = a    */
/*          state. Cyan is the sparing data accent (KPI chip, notes).  */
/* emerald/red: reserved exclusively for win/loss semantics            */
/* motif:   .tape / .tape-red hazard strips (globals.css) mark the     */
/*          report sheet and kill list — the film-slate signature      */
/*                                                                     */
/* Every interactive constant carries all four states: hover,          */
/* focus-visible, active, disabled. Motion is transform/opacity only   */
/* and gated behind motion-safe.                                       */
/* ------------------------------------------------------------------ */

/* Panel card: a visible graphite surface, not a border-only
   rectangle. Gradient runs darker toward the bottom; the top edge
   catches a cool light — the lit edge that separates panel from
   canvas at a glance. */
export const card =
  "rounded-xl border border-white/10 bg-gradient-to-b from-[#1b1a20] to-[#131317] shadow-[0_20px_48px_-16px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(240,171,252,0.06)]";

/* Border lightens on hover — no bg shift, no lift. */
export const cardHover = "transition hover:border-white/20";

/* Interactive tile: the card material plus a gentle lift. For tiles a
   pointer can rest on (steps, sections) — not for data panels. */
export const cardLift =
  "transition motion-safe:duration-200 hover:border-white/20 hover:shadow-[0_24px_56px_-16px_rgba(0,0,0,0.85),0_0_28px_-10px_rgba(217,70,239,0.2),inset_0_1px_0_rgba(240,171,252,0.09)] motion-safe:hover:-translate-y-0.5";

/* Compact card: same material at higher density — inner edge light
   only, no drop shadow (stacked shadows read bulky in grids). */
export const cardCompact =
  "rounded-lg border border-white/10 bg-gradient-to-b from-[#19181e] to-[#131317] shadow-[inset_0_1px_0_rgba(240,171,252,0.05)]";

/* Primary action: the signal gradient. White text, hot bloom. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-fuchsia-500 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_-4px_rgba(217,70,239,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:from-fuchsia-400 hover:to-pink-500 hover:shadow-[0_4px_28px_-4px_rgba(217,70,239,0.75),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-fuchsia-500 to-pink-600 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_3px_16px_-3px_rgba(217,70,239,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:from-fuchsia-400 hover:to-pink-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60";

/* Page-level secondary action: same material, 44px touch target. */
export const btnSecondaryMd =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60";

export const textLink =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-stone-400 transition hover:text-white active:text-stone-300";

/* Eyebrows/data labels are mono — the working-instrument register. */
export const eyebrow =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500";

/* Inputs recess below the panel surface: darker than the card, inner
   shadow, border wakes on hover, signal only on focus. */
export const inputBase =
  "w-full rounded-lg border border-white/10 bg-well px-3 py-2 text-sm text-stone-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-colors placeholder:text-stone-600 hover:border-white/20 focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldLabel =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500";

/* Signal-clipped key phrase for a page h1 (one per page, max).
   Hand-rolled class in globals.css for the Safari prefix. */
export const gradientText = "gradient-phrase";

/* Icon chip for section tiles: graphite well, signal icon. */
export const iconChip =
  "flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-fuchsia-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";

/* The KPI/topic chip — cyan data accent (a state, not an action). */
export const chipBlue =
  "inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300";

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
  "h-20 animate-pulse rounded-lg border border-white/10 bg-[#17161b]";

export const skeletonPanel =
  "animate-pulse rounded-xl border border-white/10 bg-[#17161b]";
