"use client";

import { useEffect, useRef } from "react";

/*
 * The interactive light rig: two purely decorative layers above the
 * body's aurora gradients, below all content (z-[-1]).
 *
 *   1. Aurora core — the hot center of the top glow. Drifts a few px
 *      toward the pointer (parallax-lite) inside an .aurora-breathe
 *      wrapper that slowly swells and dims on a 16s cycle.
 *   2. Cursor spotlight — a large, faint pool of light that trails the
 *      pointer with a lerp, so the canvas feels lit where you work.
 *
 * Constraints, in order of importance:
 *   - transform/opacity only → can never cause layout shift
 *   - fine pointers + prefers-reduced-motion: no-preference only;
 *     everyone else gets the static glow (the body gradient beneath
 *     this layer glows on its own, so nothing depends on JS)
 *   - the spotlight's RAF loop parks itself once it settles — no idle
 *     per-frame work
 */
export function AuroraGlow() {
  const coreRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const core = coreRef.current;
    const spot = spotRef.current;
    if (!core || !spot) return;
    const motionOk = window.matchMedia(
      "(prefers-reduced-motion: no-preference)"
    ).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!motionOk || !finePointer) return;

    const SPOT_HALF = 340; // half the spotlight's rendered size
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let spotX = 0;
    let spotY = 0;
    let seen = false;

    const tick = () => {
      spotX += (targetX - spotX) * 0.09;
      spotY += (targetY - spotY) * 0.09;
      spot.style.transform = `translate3d(${spotX - SPOT_HALF}px, ${spotY - SPOT_HALF}px, 0)`;
      if (Math.abs(targetX - spotX) > 0.5 || Math.abs(targetY - spotY) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0; // settled — park the loop until the pointer moves again
      }
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!seen) {
        // First movement: start from the pointer, fade in.
        seen = true;
        spotX = targetX;
        spotY = targetY;
        spot.style.opacity = "1";
      }
      const coreX = (e.clientX / window.innerWidth - 0.5) * 44;
      const coreY = (e.clientY / window.innerHeight - 0.5) * 26;
      core.style.transform = `translate3d(${coreX}px, ${coreY}px, 0)`;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className="print-hidden pointer-events-none fixed left-1/2 top-0 z-[-1] -translate-x-1/2 md:left-[calc(50%+7rem)]"
      >
        <div className="aurora-breathe">
          <div
            ref={coreRef}
            className="aurora-core h-[520px] w-[980px] -translate-y-[46%] rounded-full will-change-transform transition-transform duration-700 ease-out"
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        ref={spotRef}
        className="cursor-spotlight print-hidden pointer-events-none fixed left-0 top-0 z-[-1] h-[680px] w-[680px] rounded-full opacity-0 transition-opacity duration-500 will-change-transform"
      />
    </>
  );
}
