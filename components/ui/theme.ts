/* ------------------------------------------------------------------ */
/* Shared class-name constants — the performance-terminal identity.    */
/* canvas: ink (#0a0e1a, set in globals) under a signal-blue aurora    */
/* surfaces: navy panels clearly lighter than the canvas, lit from     */
/*           above — 1px top edge-light + deep drop shadow             */
/* wells:    inputs/data cells recess BELOW the panel (panel-deep)     */
/* accent:   signal blue (bloom reserved for real actions + verdict)   */
/* emerald/red: reserved exclusively for win/loss semantics            */
/*                                                                     */
/* Affordance rule: SOLID/gradient blue = a real, clickable action;    */
/* tinted blue = a state (active nav item, selected pill).             */
/* Every interactive constant carries all four states: hover,          */
/* focus-visible, active, disabled. Motion is transform/opacity only   */
/* and gated behind motion-safe.                                       */
/* ------------------------------------------------------------------ */

/* Panel card: a visible surface, not a border-only rectangle. Gradient
   runs darker toward the bottom and the top edge catches the aurora —
   the "lit edge" that separates panel from canvas at a glance. */
export const card =
  "rounded-2xl border border-white/10 bg-gradient-to-b from-[#182038]/95 to-[#0e1424]/95 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(164,196,255,0.10)] backdrop-blur";

/* Border lightens on hover — no bg shift, no lift. */
export const cardHover = "transition hover:border-white/20";

/* Interactive tile: the card material plus a gentle lift. For tiles a
   pointer can rest on (steps, sections) — not for data panels. */
export const cardLift =
  "transition motion-safe:duration-200 hover:border-white/20 hover:shadow-[0_24px_56px_-16px_rgba(0,0,0,0.8),0_0_24px_-8px_rgba(59,130,246,0.25),inset_0_1px_0_rgba(164,196,255,0.14)] motion-safe:hover:-translate-y-0.5";

/* Compact card: same material at higher density — inner edge light
   only, no drop shadow (stacked shadows read bulbous in grids). */
export const cardCompact =
  "rounded-xl border border-white/10 bg-gradient-to-b from-[#161d33]/90 to-[#0f1526]/90 shadow-[inset_0_1px_0_rgba(164,196,255,0.07)]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(37,99,235,0.7),0_0_20px_-2px_rgba(59,130,246,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_8px_28px_-6px_rgba(37,99,235,0.85),0_0_32px_0_rgba(59,130,246,0.5),inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:shadow-none disabled:hover:from-blue-500 disabled:hover:to-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-[0_4px_16px_-4px_rgba(37,99,235,0.7),0_0_14px_-2px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.85),0_0_24px_0_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/25 hover:bg-white/10 hover:text-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70";

/* Page-level secondary action: same material, 44px touch target. */
export const btnSecondaryMd =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/25 hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70";

export const textLink =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-zinc-400 transition hover:text-white active:text-zinc-300";

/* Eyebrows/data labels are mono — the "performance terminal" register. */
export const eyebrow =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

/* Inputs recess below the panel surface: darker than the card, inner
   shadow, border wakes on hover, glow only on focus. */
export const inputBase =
  "w-full rounded-lg border border-white/10 bg-panel-deep/90 px-3 py-2 text-sm text-zinc-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-colors placeholder:text-zinc-600 hover:border-white/20 focus:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldLabel =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500";

/* Gradient headline treatment — the original hero's sky→blue clip, for
   the key phrase of a page h1 (one per page, max). A hand-rolled class
   in globals.css: Safari needs -webkit-background-clip to render it. */
export const gradientText = "gradient-phrase";

/* Accent icon chip for section tiles: tinted gradient + faint bloom. */
export const iconChip =
  "flex items-center justify-center rounded-lg border border-blue-400/30 bg-gradient-to-br from-blue-500/30 to-blue-600/10 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.25),inset_0_1px_0_rgba(147,197,253,0.15)]";

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
