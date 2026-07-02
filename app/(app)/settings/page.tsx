"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui/kit";
import { btnSecondary } from "@/components/ui/theme";

export default function SettingsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/meta/session")
      .then((res) => res.json())
      .then((data) => setConnected(!!data.connected))
      .catch(() => setConnected(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Connections, branding, and workspace."
      />

      <Card className="mt-6 max-w-xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-100">Meta Ads</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {connected === null
                ? "Checking connection…"
                : connected
                  ? "Connected. Long-lived session (~60 days)."
                  : "Not connected."}
            </p>
          </div>
          <a href="/api/meta/oauth/start" className={`shrink-0 ${btnSecondary}`}>
            {connected ? "Reconnect" : "Connect"}
          </a>
        </div>
      </Card>

      <Card className="mt-3 max-w-xl p-5 sm:p-6">
        <p className="text-sm font-semibold text-zinc-100">
          Branding &amp; delivery
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Logo, accent color, and report sender settings arrive with the
          Reports module (M4/M7).
        </p>
      </Card>
    </div>
  );
}
