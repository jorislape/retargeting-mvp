/* ------------------------------------------------------------------ */
/* Shared class-name constants — the performance-terminal identity.    */
/* canvas: ink (#0a0e1a, set in globals) with a fixed radial glow      */
/* surfaces: navy panels a hair lighter than the canvas, with a soft   */
/*           drop shadow + a 1px inner top highlight (the "lit edge")  */
/* accent: signal blue (glow reserved for real actions + the verdict)  */
/* emerald/red: reserved exclusively for win/loss semantics            */
/*                                                                     */
/* Affordance rule: SOLID/gradient blue = a real, clickable action;    */
/* tinted blue = a state (active nav item, selected pill).             */
/* ------------------------------------------------------------------ */

/* Panel card: a visible surface, not a border-only rectangle. Gradient
   runs a few percent darker toward the bottom so the panel reads as
   catching the canvas glow from above. */
export const card =
  "rounded-2xl border border-white/10 bg-gradient-to-b from-[#151c31]/95 to-[#0e1424]/95 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur";

/* Border lightens on hover — no bg shift, no lift. */
export const cardHover = "transition hover:border-white/20";

/* Compact card: same material at higher density — inner edge light
   only, no drop shadow (stacked shadows read bulbous in grids). */
export const cardCompact =
  "rounded-xl border border-white/10 bg-gradient-to-b from-[#141a2d]/90 to-[#0f1526]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/40 transition hover:from-blue-400 hover:to-blue-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow shadow-blue-600/40 transition hover:from-blue-400 hover:to-blue-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60";

/* Page-level secondary action: same material, 44px touch target. */
export const btnSecondaryMd =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60";

export const textLink =
  "inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white";

/* Eyebrows/data labels are mono — the "performance terminal" register. */
export const eyebrow =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

/* Inputs recess below the panel surface: darker than the card, subtle
   inner shadow, glow only on focus. */
export const inputBase =
  "w-full rounded-lg border border-white/10 bg-panel-deep/80 px-3 py-2 text-sm text-zinc-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] placeholder:text-zinc-600 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30";

export const fieldLabel =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

/* Gradient headline treatment — the original hero's sky→blue clip,
   for the key phrase of a page h1 (one per page, max). */
export const gradientText =
  "bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent";

/* Accent icon chip for section tiles: tinted gradient + faint glow. */
export const iconChip =
  "flex items-center justify-center rounded-lg border border-blue-400/25 bg-gradient-to-br from-blue-500/25 to-blue-600/5 text-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.15)]";

export const chipBlue =
  "inline-flex items-center gap-1.5 rounded-full border border-blue-400/25 bg-blue-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-300";

export const chipEmerald =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300";

export const chipAmber =
  "inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300";

export const chipNeutral =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400";

export const chipRed =
  "inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300";

/* Skeletons mimic the card material they stand in for. */
export const skeletonTile =
  "h-20 animate-pulse rounded-xl border border-white/10 bg-[#121829]/70";

export const skeletonPanel =
  "animate-pulse rounded-2xl border border-white/10 bg-[#121829]/70";
