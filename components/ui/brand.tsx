/* ------------------------------------------------------------------ */
/* Brand mark shared across the workspace shell: the amber signal      */
/* stamp — hot key of the night desk, dark glyph on solid amber.       */
/* ------------------------------------------------------------------ */

export function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_2px_12px_-2px_rgba(251,191,36,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-amber-200/20`}
    >
      <svg
        viewBox="0 0 24 24"
        className="text-stone-950"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ height: "55%", width: "55%" }}
      >
        <path d="M21 2 13.5 12.5" />
        <path d="M21 2l-4 20-5-9-9-5 18-6z" />
      </svg>
    </div>
  );
}
