"use client";

import { useEffect, useRef } from "react";

/*
 * The desk lamp: a large, faint pool of warm light that trails the
 * pointer. Purely decorative, above the body's haze/grid, below all
 * content (z-[-1]).
 *
 * Constraints, in order of importance:
 *   - transform/opacity only → can never cause layout shift
 *   - fine pointers + prefers-reduced-motion: no-preference only;
 *     everyone else keeps the static haze (nothing depends on JS)
 *   - the RAF loop parks itself once the light settles — no idle
 *     per-frame work
 */
export function Atmosphere() {
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spot = spotRef.current;
    if (!spot) return;
    const motionOk = window.matchMedia(
      "(prefers-reduced-motion: no-preference)"
    ).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!motionOk || !finePointer) return;

    const HALF = 330; // half the spotlight's rendered size
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let seen = false;

    const tick = () => {
      x += (targetX - x) * 0.09;
      y += (targetY - y) * 0.09;
      spot.style.transform = `translate3d(${x - HALF}px, ${y - HALF}px, 0)`;
      if (Math.abs(targetX - x) > 0.5 || Math.abs(targetY - y) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0; // settled — park until the pointer moves again
      }
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!seen) {
        seen = true;
        x = targetX;
        y = targetY;
        spot.style.opacity = "1";
      }
      if (!raf) raf = requestAnimationFrame(tick);
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
      ref={spotRef}
      className="cursor-spotlight print-hidden pointer-events-none fixed left-0 top-0 z-[-1] h-[660px] w-[660px] rounded-full opacity-0 transition-opacity duration-500 will-change-transform"
    />
  );
}
