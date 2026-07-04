/* ------------------------------------------------------------------ */
/* Brand mark shared across the workspace shell: a solid ink tile with */
/* the send glyph — a stamp, not a glow. Quietly confident.            */
/* ------------------------------------------------------------------ */

export function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-zinc-900 shadow-[0_1px_2px_rgba(23,25,29,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-zinc-900/10`}
    >
      <svg
        viewBox="0 0 24 24"
        className="text-white"
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
