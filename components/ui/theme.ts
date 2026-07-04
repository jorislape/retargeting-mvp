/* ------------------------------------------------------------------ */
/* Shared class-name constants — "the dossier" identity.               */
/* canvas:  carbon (#0e0e10, set in globals) with one faint warm cast  */
/* surface: FLAT panels (bg-panel) one step lighter than the canvas,   */
/*          hairline borders — depth from rules and spacing, never     */
/*          from glows or gradients                                    */
/* wells:   inputs recess below the panel (bg-well)                    */
/* accent:  brass (muted gold). Solid brass with dark text = the one   */
/*          primary action per screen; brass text/rule = a marker.     */
/* emerald/red: win/loss only, as plain colored text — no pills        */
/* type:    serif display (Source Serif 4) over Plex Sans/Mono         */
/*                                                                     */
/* Every interactive constant carries all four states: hover,          */
/* focus-visible, active, disabled. Motion is transform/opacity only   */
/* and gated behind motion-safe.                                       */
/* ------------------------------------------------------------------ */

/* Panel: flat surface, hairline edge, whisper of shadow. */
export const card =
  "rounded-lg border border-white/[0.08] bg-panel shadow-[0_1px_0_rgba(0,0,0,0.4)]";

/* Border lightens on hover — no bg shift, no lift. */
export const cardHover = "transition-colors hover:border-white/20";

/* Interactive tile: flat panel that wakes on hover. */
export const cardLift =
  "transition motion-safe:duration-200 hover:border-white/20 hover:bg-[#1a1a1e]";

/* Compact card: same flat material at higher density. */
export const cardCompact =
  "rounded-lg border border-white/[0.08] bg-panel";

/* Primary action: solid brass, near-black text. One per screen. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brass px-5 py-2.5 text-sm font-semibold text-[#141414] transition hover:bg-brass-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brass px-3.5 py-2 text-sm font-semibold text-[#141414] transition hover:bg-brass-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-white/30 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60";

/* Page-level secondary action: same material, 44px touch target. */
export const btnSecondaryMd =
  "inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-transparent px-4 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-white/30 hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60";

export const textLink =
  "inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-stone-400 transition hover:text-white active:text-stone-300";

/* Eyebrows/data labels are mono small caps — the document register. */
export const eyebrow =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500";

/* Inputs recess below the panel: darker, hairline border, brass on
   focus. */
export const inputBase =
  "w-full rounded-md border border-white/10 bg-well px-3 py-2 text-sm text-stone-100 transition-colors placeholder:text-stone-600 hover:border-white/20 focus:border-brass/60 focus:outline-none focus:ring-1 focus:ring-brass/30 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldLabel =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500";

/* Brass key phrase for a page h1 (one per page, max). Class defined
   in globals.css; name kept for callers. */
export const gradientText = "gradient-phrase";

/* Icon chip for section tiles: hairline square, brass icon. */
export const iconChip =
  "flex items-center justify-center rounded-md border border-white/10 bg-transparent text-brass-soft";

/* Editorial "chips": mono small caps colored TEXT, no pill. Names are
   kept for compatibility; the pill era is over. */
export const chipBlue =
  "inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brass-soft";

export const chipEmerald =
  "inline-flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums text-emerald-400";

export const chipAmber =
  "inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-amber-300";

export const chipNeutral =
  "inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500";

export const chipRed =
  "inline-flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums text-red-400";

/* Skeletons mimic the flat panel they stand in for. */
export const skeletonTile =
  "h-20 animate-pulse rounded-lg border border-white/[0.08] bg-panel";

export const skeletonPanel =
  "animate-pulse rounded-lg border border-white/[0.08] bg-panel";
