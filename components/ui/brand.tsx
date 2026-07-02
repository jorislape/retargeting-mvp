/* ------------------------------------------------------------------ */
/* Brand mark shared by the landing page and the app shell.            */
/* Moved verbatim from app/page.tsx — render output must stay          */
/* identical there.                                                    */
/* ------------------------------------------------------------------ */

export function LogoMark({ size = "h-8 w-8" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-blue-500/20`}
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
