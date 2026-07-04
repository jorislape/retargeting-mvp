"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/* The one ambient element: a faint icy spotlight that follows the     */
/* cursor across the hero. Accent at 7% — presence, not an effect.     */
/* Renders nothing at all for reduced-motion or touch-only devices;    */
/* pointer-events-none and aria-hidden always.                         */
/* ------------------------------------------------------------------ */

export function HeroSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = parent.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        el.style.background = `radial-gradient(520px 360px at ${x}px ${y}px, rgba(56,189,248,0.07), transparent 70%)`;
        el.style.opacity = "1";
        raf = 0;
      });
    };
    const onLeave = () => {
      el.style.opacity = "0";
    };

    parent.addEventListener("pointermove", onMove);
    parent.addEventListener("pointerleave", onLeave);
    return () => {
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500"
    />
  );
}
