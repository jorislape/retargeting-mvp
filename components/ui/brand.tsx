/* ------------------------------------------------------------------ */
/* Brand mark shared across the workspace shell: the signal stamp —   */
/* white glyph on the fuchsia→pink gradient. Hot, graphic, singular.   */
/* ------------------------------------------------------------------ */

export function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-[0_2px_14px_-2px_rgba(217,70,239,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] ring-1 ring-fuchsia-300/20`}
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
