import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
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
  /* See lib/site.ts — resolves to the real Vercel production domain
     with no manual env var required, local dev only falls back to
     localhost. */
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Debrief — Meta Ads creative debrief",
    template: "%s · Debrief",
  },
  description:
    "Turn Meta Ads data into buyer memos, client-ready reports, next creative tests, and creative briefs. CSV upload or read-only Meta import — no login required, ads data never stored on our servers.",
  openGraph: {
    siteName: "Debrief",
    type: "website",
    url: "/",
    title: "Debrief — Your Meta Ads data, turned into a decision",
    description:
      "Turn Meta Ads data into buyer memos, client-ready reports, next creative tests, and creative briefs — CSV upload or read-only Meta import. No login, ads data never stored on our servers.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Debrief — Your Meta Ads data, turned into a decision",
    description:
      "Turn Meta Ads data into buyer memos, client-ready reports, next creative tests, and creative briefs — CSV upload or read-only Meta import. No login, ads data never stored on our servers.",
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
