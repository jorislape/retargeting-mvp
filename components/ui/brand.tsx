/* ------------------------------------------------------------------ */
/* Brand.                                                              */
/* Wordmark: type only — bold Geist, tightened tracking, accent        */
/* period. This is the brand in every nav.                             */
/* LogoMark (white tile, dark plane glyph) survives ONLY for icon      */
/* surfaces: favicon, browser tab, OG/social image. Never in chrome.   */
/* ------------------------------------------------------------------ */

export function Wordmark({ className = "text-[15px]" }: { className?: string }) {
  return (
    <span
      className={`font-semibold tracking-[-0.01em] text-zinc-100 ${className}`}
    >
      Debrief
      <span className="text-accent">.</span>
    </span>
  );
}

export function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]`}
    >
      <svg
        viewBox="0 0 24 24"
        className="text-zinc-950"
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
