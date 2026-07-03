import type { Metadata, Viewport } from "next";
import "./globals.css";

/*
 * Fonts: next/font/google (Geist) was removed because it fetches from
 * Google Fonts at build time, which fails in offline/sandboxed CI and
 * couples every build to an external service. The CSS variables below keep
 * the same names, so restoring next/font/google (or vendoring Geist via
 * next/font/local) is a 5-line revert if you want the exact typeface back.
 */

export const metadata: Metadata = {
  title: "Debrief — Meta Ads creative debrief",
  description:
    "Upload your Meta Ads CSV and get a decision-first debrief: what worked, what failed, and what to test next. No login, nothing stored.",
};

/* This is the fix for the mobile dashboard rendering at desktop width and
   getting cut off. width=device-width + initial-scale=1 tells mobile
   browsers to use the real device width instead of the ~980px default.
   No maximumScale / userScalable here on purpose — blocking zoom hurts
   accessibility. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
