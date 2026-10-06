"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";

/**
 * Report Clarity Pass — an inline explanation for a buyer-register term.
 *
 * Accessible by construction: the term is keyboard-focusable and points
 * at its explanation with aria-describedby. The description text always
 * exists inline (screen-reader-only), so assistive tech announces it
 * whether or not the visual bubble is open.
 *
 * Tester Feedback follow-up: the visual bubble is PORTALED to
 * document.body with position: fixed. As an in-place child it lived
 * inside whatever stacking context its ancestors created (the report
 * masthead's entrance animation creates one), so a later sibling — the
 * Next-move card — painted over it no matter its z-index. From the
 * body it sits above everything; it flips above the trigger when there
 * isn't room below and is clamped inside the viewport, so it never
 * clips or causes horizontal scroll on a phone. It opens on hover AND
 * keyboard focus, closes on leave/blur/Escape/scroll/resize, and is
 * print-hidden, so the PDF stays clean. Explanations reuse the report's
 * existing client-register wording; this component invents none.
 */

const bubble =
  "print-hidden pointer-events-none fixed z-[1000] w-max max-w-[min(16rem,calc(100vw-1rem))] rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-zinc-200 shadow-lg";

/** Viewport margin the bubble always keeps (px). */
const EDGE = 8;
/** Gap between trigger and bubble (px). */
const GAP = 6;

type Anchor = { top: number; bottom: number; left: number };

/** Open/close state for one tooltip trigger. Spread `triggerProps` on
 *  the focusable trigger and render <TipBubble id anchor> next to it. */
export function useTip() {
  const id = useId();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const show = (e: SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor({ top: r.top, bottom: r.bottom, left: r.left });
  };
  const hide = () => setAnchor(null);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // A fixed bubble would detach from its term on scroll — close instead.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  return {
    id,
    anchor,
    triggerProps: {
      "aria-describedby": id,
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
    },
  };
}

/** The visual bubble, positioned against the trigger's rect. Placement
 *  is applied to the DOM in a layout effect (before paint) — measured,
 *  flipped above when there's no room below, clamped horizontally. */
function FloatingBubble({ anchor, children }: { anchor: Anchor; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const left = Math.max(EDGE, Math.min(anchor.left, vw - EDGE - width));
    const below = anchor.bottom + GAP;
    const top =
      below + height > vh - EDGE && anchor.top - GAP - height >= EDGE
        ? anchor.top - GAP - height
        : below;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.visibility = "visible";
  }, [anchor]);
  return (
    <span ref={ref} aria-hidden="true" data-tip-bubble="" className={bubble} style={{ left: 0, top: 0, visibility: "hidden" }}>
      {children}
    </span>
  );
}

/** The explanation: an always-present screen-reader description (the
 *  aria-describedby target) plus, while open, the portaled visual
 *  bubble. */
export function TipBubble({
  id,
  anchor,
  children,
}: {
  id: string;
  anchor: Anchor | null;
  children: ReactNode;
}) {
  return (
    <>
      <span id={id} role="tooltip" className="sr-only">
        {children}
      </span>
      {anchor && typeof document !== "undefined"
        ? createPortal(<FloatingBubble anchor={anchor}>{children}</FloatingBubble>, document.body)
        : null}
    </>
  );
}

/** A term with its explanation: focusable, described, hover/focus to show. */
export function Term({ tip, children }: { tip: string; children: ReactNode }) {
  const t = useTip();
  return (
    <span className="inline-block">
      <span
        tabIndex={0}
        {...t.triggerProps}
        className="cursor-help rounded-sm underline decoration-zinc-500 decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {children}
      </span>
      <TipBubble id={t.id} anchor={t.anchor}>
        {tip}
      </TipBubble>
    </span>
  );
}

/** Wraps every occurrence of the given phrases in `text` with a Term. */
export function withTerms(text: string, terms: { phrase: string; tip: string }[]): ReactNode[] {
  const active = terms.filter((t) => text.includes(t.phrase));
  if (active.length === 0) return [text];
  const pattern = new RegExp(`(${active.map((t) => t.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(pattern).map((part, i) => {
    const term = active.find((t) => t.phrase === part);
    return term ? (
      <Term key={i} tip={term.tip}>
        {part}
      </Term>
    ) : (
      part
    );
  });
}
