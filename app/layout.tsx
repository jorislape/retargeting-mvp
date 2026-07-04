import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/*
 * Type system — one contemporary family, weight-driven hierarchy:
 *   Geist       → everything set in prose and UI (display = weight +
 *                 tracking, not a second family)
 *   Geist Mono  → numerals, filenames, table data
 * Wired into Tailwind via CSS variables in globals.css (@theme inline),
 * so `font-display` / `font-sans` / `font-mono` utilities map to them.
 */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  /* Local/self-hosted fallback; Vercel infers the production URL. */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Debrief — Meta Ads creative debrief",
    template: "%s · Debrief",
  },
  description:
    "Upload your Meta Ads CSV and get a decision-first debrief: what worked, what failed, and what to test next. No login, nothing stored.",
  openGraph: {
    siteName: "Debrief",
    type: "website",
    url: "/",
    title: "Debrief — Your Meta Ads export, turned into a decision",
    description:
      "Buyer memo, client report, next creative tests, and briefs — from the CSV you already have. No login, nothing stored.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Debrief — Your Meta Ads export, turned into a decision",
    description:
      "Buyer memo, client report, next creative tests, and briefs — from the CSV you already have. No login, nothing stored.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0c0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
