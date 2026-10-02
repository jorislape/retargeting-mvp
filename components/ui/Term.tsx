"use client";

import { useId, type ReactNode, type SyntheticEvent } from "react";

/**
 * Report Clarity Pass — an inline explanation for a buyer-register term.
 *
 * Accessible by construction: the term is keyboard-focusable and points
 * at its explanation with aria-describedby, so screen readers announce
 * it and sighted keyboard users see it on focus (not hover only). The
 * bubble is display:none until hover/focus — so it never adds layout
 * width on narrow screens while closed — and is print-hidden, so the
 * PDF stays clean. Explanations reuse the report's existing client-
 * register wording; this component invents no definitions.
 */

const bubble =
  "print-hidden pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-max max-w-[min(16rem,calc(100vw-1rem))] rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-zinc-200 shadow-lg group-hover:block group-focus-within:block";

/** Keeps an open bubble inside the viewport: on hover/focus of the
 *  trigger, find its bubble and shift it just enough to clear an 8px
 *  margin, so a term near the screen edge never causes horizontal
 *  scroll on a phone. Reads the DOM from the event — no refs. */
export function clampTip(e: SyntheticEvent<HTMLElement>) {
  const el = e.currentTarget.querySelector<HTMLElement>('[role="tooltip"]');
  if (!el) return;
  el.style.transform = "";
  requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    const vw = document.documentElement.clientWidth;
    const pad = 8;
    let shift = 0;
    if (r.right > vw - pad) shift = vw - pad - r.right;
    if (r.left + shift < pad) shift = pad - r.left;
    if (shift !== 0) el.style.transform = `translateX(${Math.round(shift)}px)`;
  });
}

/** The explanation bubble. Place it inside an element carrying `group`
 *  and `relative` whose focus/hover should reveal it. */
export function TipBubble({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} role="tooltip" className={bubble}>
      {children}
    </span>
  );
}

/** A term with its explanation: focusable, described, hover/focus to show. */
export function Term({ tip, children }: { tip: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="group relative inline-block" onMouseEnter={clampTip} onFocus={clampTip}>
      <span
        tabIndex={0}
        aria-describedby={id}
        className="cursor-help rounded-sm underline decoration-zinc-500 decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {children}
      </span>
      <TipBubble id={id}>{tip}</TipBubble>
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
