/* ------------------------------------------------------------------ */
/* Shared class-name constants — modern dark SaaS.                     */
/* canvas:  carbon (#0b0c0f, set in globals) under one cool light      */
/* surface: soft translucent layers (white 3–5%) with hairline         */
/*          borders and generous radius — layered, never boxy          */
/* actions: WHITE with dark text is the primary action; the accent    */
/*          (icy cyan, bg-accent/text-accent-soft) marks selection,    */
/*          progress, and focus — never large fills                    */
/* emerald/red: win/loss only, as plain colored text — no pills        */
/* type:    Geist, hierarchy by weight/tracking; Geist Mono for        */
/*          numerals and data only                                     */
/*                                                                     */
/* Every interactive constant carries all four states: hover,          */
/* focus-visible, active, disabled. Motion is transform/opacity only   */
/* and gated behind motion-safe.                                       */
/* ------------------------------------------------------------------ */

/* Surface card: a soft layer above the canvas — raised enough to read
   as a distinct surface at a glance, not just a slightly-different
   shade of the background. */
export const card =
  "rounded-xl border border-white/[0.08] bg-white/[0.045]";

/* Nested/secondary surface: content one level inside a `card` (e.g. a
   sub-item within a card-level section). Deliberately quieter than
   `card` so nesting reads as hierarchy, not as another equally-loud
   block. */
export const cardNested =
  "rounded-lg border border-white/[0.05] bg-white/[0.02]";

/* Layer wakes on hover — border and fill lighten together. */
export const cardHover =
  "transition-colors hover:border-white/[0.14] hover:bg-white/[0.065]";

/* Interactive tile: the card material plus a gentle lift. */
export const cardLift =
  "transition motion-safe:duration-200 hover:border-white/[0.14] hover:bg-white/[0.065] motion-safe:hover:-translate-y-0.5";

/* Primary action: white, dark text. One per screen. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

/* Page-level secondary action: same material, 44px touch target. */
export const btnSecondaryMd =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

/* Section/eyebrow labels: quiet sans, light tracking — not the small-
   caps mono of the previous era. */
export const eyebrow =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400";

/* Inputs: soft field on the surface, accent on focus. */
export const inputBase =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 hover:border-white/20 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50";

export const fieldLabel = "text-xs font-medium text-zinc-400";

/* White→icy key phrase for a page h1 (one per page, max). Class
   defined in globals.css; name kept for callers. */
export const gradientText = "gradient-phrase";

/* Icon chip for section tiles: soft layer, accent icon. */
export const iconChip =
  "flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-accent-soft";
