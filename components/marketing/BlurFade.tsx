"use client";

import { ReactNode } from "react";
import { LazyMotion, m, useReducedMotion } from "motion/react";

const loadFeatures = () =>
  import("./motionFeatures").then((mod) => mod.default);

/* ------------------------------------------------------------------ */
/* Blur-fade entrance on scroll into view. Runs once, transform/       */
/* opacity/filter only. Reduced motion renders the children plainly —  */
/* no hidden initial state, no animation.                              */
/* ------------------------------------------------------------------ */

export function BlurFade({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion() ?? false;

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={loadFeatures} strict>
      <m.div
        className={className}
        initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
