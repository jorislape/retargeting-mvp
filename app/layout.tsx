import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

/*
 * Type system — the editorial commitment:
 *   Source Serif 4 → display (report titles, verdicts, section leads)
 *   IBM Plex Sans  → body
 *   IBM Plex Mono  → data labels, eyebrows, numerals in tables
 * Wired into Tailwind via CSS variables in globals.css (@theme inline),
 * so `font-display` / `font-sans` / `font-mono` utilities map to them.
 */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-sg",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Debrief — Meta Ads creative debrief",
  description:
    "Upload your Meta Ads CSV and get a decision-first debrief: what worked, what failed, and what to test next. No login, nothing stored.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0e10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
