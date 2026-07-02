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
  title: "AdReports — Meta Ads client reporting & monitoring",
  description:
    "Automated client reports and always-on account monitoring for Meta Ads. Connect once, every client gets a scheduled report with a written summary.",
};

/* This is the fix for the mobile dashboard rendering at desktop width and
   getting cut off. width=device-width + initial-scale=1 tells mobile
   browsers to use the real device width instead of the ~980px default.
   No maximumScale / userScalable here on purpose — blocking zoom hurts
   accessibility. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
