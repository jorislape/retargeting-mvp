import type { ReactNode } from "react";

/*
 * generator/page.tsx is a Client Component ("use client", for the
 * DebriefProvider-driven state machine), and Next.js doesn't allow a
 * `metadata` export from a Client Component — so this route had no
 * page-specific title/canonical at all and silently inherited the bare
 * root default. This layout is a Server Component that exists purely
 * to carry that metadata; it renders no markup of its own.
 */
export const metadata = {
  title: "Generator",
  description:
    "Load your Meta Ads CSV and get a decision-first debrief — what worked, what failed, and what to test next.",
  alternates: { canonical: "/generator" },
};

export default function GeneratorLayout({ children }: { children: ReactNode }) {
  return children;
}
