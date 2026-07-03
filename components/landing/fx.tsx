"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Landing-page motion effects. Progressive enhancement only:          */
/* - SSR/no-JS renders everything fully visible (no content hostage).  */
/* - prefers-reduced-motion disables both effects entirely.            */
/* - Animations are transform/opacity only.                            */
/* ------------------------------------------------------------------ */

/* Scroll-triggered entrance. Elements already in the viewport on mount
   stay visible (no above-the-fold flash); elements below the fold hide,
   then rise in once ~15% visible. Runs once per element. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          io.disconnect();
        } else {
          setHidden(true);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[opacity,transform] duration-700 ease-out ${
        hidden ? "translate-y-5 opacity-0" : "translate-y-0 opacity-100"
      } ${className}`}
    >
      {children}
    </div>
  );
}

