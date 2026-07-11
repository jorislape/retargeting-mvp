import { ImageResponse } from "next/og";

/* ------------------------------------------------------------------ */
/* OG / social card — generated in the brand language (carbon canvas,  */
/* white tile + plane glyph, icy accent, win/loss as plain colored     */
/* text) so link unfurls match the product.                            */
/* ------------------------------------------------------------------ */

export const alt =
  "Debrief — your Meta Ads data, turned into a decision";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#0b0c0f",
          backgroundImage:
            "radial-gradient(900px 420px at 50% -160px, rgba(56,189,248,0.10), transparent 70%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 14,
              backgroundColor: "#ffffff",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="36"
              height="36"
              fill="none"
              stroke="#09090b"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2 13.5 12.5" />
              <path d="M21 2l-4 20-5-9-9-5 18-6z" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
            Debrief
            <span style={{ color: "#38bdf8" }}>.</span>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.08,
              maxWidth: 1000,
            }}
          >
            Your Meta Ads data, turned into a decision.
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#a1a1aa" }}>
            Buyer memo · client report · next tests · creative briefs. No
            login, ads data never stored on our servers.
          </div>
        </div>

        {/* Proof row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
          }}
        >
          <div style={{ display: "flex", gap: 40 }}>
            <div style={{ display: "flex", gap: 12, color: "#34d399" }}>
              <span style={{ fontWeight: 700 }}>SCALE</span>
              <span>4.62× ROAS</span>
            </div>
            <div style={{ display: "flex", gap: 12, color: "#f87171" }}>
              <span style={{ fontWeight: 700 }}>CUT</span>
              <span>0.62× ROAS</span>
            </div>
          </div>
          <div style={{ display: "flex", color: "#71717a" }}>
            Rules, not a model — same input, same answer.
          </div>
        </div>
      </div>
    ),
    size
  );
}
