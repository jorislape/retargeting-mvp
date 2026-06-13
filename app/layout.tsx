import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meta Retargeting — launch in under a minute",
  description:
    "Connect Meta, reuse a proven creative, set a budget — the custom audience, ad set, and ad are created for you, paused until you approve.",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
