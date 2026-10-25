"use client";

/**
 * Bulletproof pass C8 — "Print / Save PDF" with a one-time Safari hint.
 *
 * Chromium can't print its own header/footer over the report (the print
 * CSS sets a zero page margin there — see app/globals.css, pass B8), but
 * WebKit draws its header/footer whenever the print dialog's "Print
 * headers and footers" box is ticked, whatever the CSS. So in WebKit the
 * first click shows a small inline notice with a Print button and "Don't
 * show again"; everywhere else the click prints straight away.
 *
 * WebKit is detected the same way the print CSS excludes it: a keyword
 * only WebKit parses (font: -apple-system-body). "Don't show again" is a
 * UI preference in localStorage — never ads data — read and written in
 * try/catch, so a blocked or private storage simply shows the notice.
 */
import { useState } from "react";
import { PrinterIcon } from "@/components/ui/icons";
import { btnPrimarySm, btnSecondary } from "@/components/ui/theme";

export const PRINT_REMINDER_KEY = "debrief.printReminderDismissed.v1";

function isWebKit(): boolean {
  try {
    return typeof CSS !== "undefined" && CSS.supports("font: -apple-system-body");
  } catch {
    return false;
  }
}

function dismissed(): boolean {
  try {
    return window.localStorage.getItem(PRINT_REMINDER_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed(): void {
  try {
    window.localStorage.setItem(PRINT_REMINDER_KEY, "1");
  } catch {
    /* storage unavailable — the notice shows again next time */
  }
}

export function PrintButton() {
  const [notice, setNotice] = useState(false);
  const print = () => {
    setNotice(false);
    window.print();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => (isWebKit() && !dismissed() ? setNotice(true) : window.print())}
        aria-expanded={notice}
        title="Choose “Save as PDF” in the print dialog and disable browser headers and footers for the cleanest export."
        className={`cursor-pointer ${btnPrimarySm}`}
      >
        <PrinterIcon className="h-3.5 w-3.5" />
        Print / Save PDF
      </button>
      {notice && (
        <div
          role="status"
          className="print-hidden flex basis-full flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-zinc-300"
        >
          <span className="mr-auto">
            In Safari: <span className="font-medium text-zinc-100">Show details</span> → uncheck{" "}
            <span className="font-medium text-zinc-100">“Print headers and footers”</span>.
          </span>
          <button type="button" onClick={print} className={`cursor-pointer ${btnPrimarySm}`}>
            Print
          </button>
          <button
            type="button"
            onClick={() => {
              rememberDismissed();
              print();
            }}
            className={`cursor-pointer ${btnSecondary}`}
          >
            Don&apos;t show again
          </button>
        </div>
      )}
    </>
  );
}
