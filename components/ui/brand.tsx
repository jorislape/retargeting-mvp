/* ------------------------------------------------------------------ */
/* Brand mark shared across the workspace shell.                       */
/* ------------------------------------------------------------------ */

export function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_4px_16px_rgba(37,99,235,0.55),0_0_24px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/15`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5 text-white"
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
