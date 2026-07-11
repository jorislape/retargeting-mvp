"use client";

import { Component, type ReactNode } from "react";
import { UNAVAILABLE_MESSAGE } from "./copy";

/**
 * Isolation fuse for the monitoring UI: any render/runtime failure
 * inside the monitoring section becomes this inline card. The
 * generator page around it is never affected — the core product must
 * work even if monitoring is broken or deleted.
 */
export class MonitoringErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Outcome-only: no error details, no URLs, nothing user-specific.
    console.log("monitoring.ui outcome=render_error");
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/[0.05] px-3 py-2.5 text-xs leading-relaxed text-amber-200">
          {UNAVAILABLE_MESSAGE}
        </p>
      );
    }
    return this.props.children;
  }
}
