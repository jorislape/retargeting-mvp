"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Blur-fade entrance on scroll into view. CSS does all the work: the  */
/* hidden initial state lives behind prefers-reduced-motion:           */
/* no-preference in globals.css, so reduced-motion users (and the      */
/* server) always get plain, visible markup — no hydration branching,  */
/* no motion bundle. The observer just flips a class, once.            */
/* ------------------------------------------------------------------ */

export function BlurFade({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ "--bf-delay": `${delay}s` } as CSSProperties}
      className={`blur-fade ${inView ? "blur-fade-in" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
