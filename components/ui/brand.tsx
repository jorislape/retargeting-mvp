/* ------------------------------------------------------------------ */
/* Brand mark: a brass-ruled square, glyph set in brass. A seal, not   */
/* a glow — restrained, like everything else in the dossier.           */
/* ------------------------------------------------------------------ */

export function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-md border border-brass/50 bg-brass/[0.06]`}
    >
      <svg
        viewBox="0 0 24 24"
        className="text-brass-soft"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
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
