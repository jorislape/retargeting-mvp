"use client";

import { useEffect, useRef } from "react";

/*
 * The aurora's hot core: a fixed, purely decorative light source above
 * the content that drifts a few pixels toward the pointer (parallax-
 * lite). Constraints, in order of importance:
 *   - transform/opacity only → can never cause layout shift
 *   - fine pointers + prefers-reduced-motion: no-preference only;
 *     everyone else gets the static glow (the body gradient beneath
 *     this layer glows on its own, so nothing depends on JS)
 *   - z-[-1] like the grid: above the canvas, below all content
 */
export function AuroraGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motionOk = window.matchMedia(
      "(prefers-reduced-motion: no-preference)"
    ).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!motionOk || !finePointer) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 44;
      const y = (e.clientY / window.innerHeight - 0.5) * 26;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="print-hidden pointer-events-none fixed left-1/2 top-0 z-[-1] -translate-x-1/2 md:left-[calc(50%+7rem)]"
    >
      <div
        ref={ref}
        className="aurora-core h-[520px] w-[980px] -translate-y-[46%] rounded-full will-change-transform transition-transform duration-700 ease-out"
      />
    </div>
  );
}
