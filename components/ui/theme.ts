/* ------------------------------------------------------------------ */
/* Shared class-name constants — the landing page design language      */
/* (app/page.tsx) applied to the app shell.                            */
/* bg: zinc-950 · cards: zinc-900/60 + border-white/10                 */
/* accent: blue-600 · success: emerald · paused: amber                 */
/*                                                                     */
/* Affordance rule (same as landing): SOLID blue = a real, clickable   */
/* action; tinted blue = a state (active nav item, selected pill).     */
/* ------------------------------------------------------------------ */

/* Panel card: settings cards, empty states, sparkline, table shell. */
export const card =
  "rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl shadow-black/20 backdrop-blur";

/* Border lightens on hover — no bg shift, no lift (landing motion rule). */
export const cardHover = "transition hover:border-white/20";

/* Compact card: KPI tiles and account cards. Same glass material,
   xl radius and no shadow/blur — six stacked drop-shadows read bulbous
   at this density. */
export const cardCompact = "rounded-xl border border-white/10 bg-zinc-900/60";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow shadow-blue-600/25 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400/50";

export const textLink =
  "inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white";

export const eyebrow =
  "text-[11px] font-semibold uppercase tracking-wider text-zinc-500";

export const chipEmerald =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300";

export const chipAmber =
  "inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300";

export const chipNeutral =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400";

export const tableWrap =
  "overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 shadow-xl shadow-black/20 backdrop-blur";

export const tableHead =
  "border-b border-white/10 bg-white/[0.03] text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500";

export const tableRow =
  "border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.03]";

/* Skeletons mimic the card material they stand in for. */
export const skeletonTile =
  "h-20 animate-pulse rounded-xl border border-white/10 bg-zinc-900/60";

export const skeletonPanel =
  "animate-pulse rounded-2xl border border-white/10 bg-zinc-900/60";
