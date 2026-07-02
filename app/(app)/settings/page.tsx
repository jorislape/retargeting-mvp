"use client";

import { useEffect, useState } from "react";

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
      <h1 className="text-lg font-bold tracking-tight">Settings</h1>
      <p className="mt-0.5 text-sm text-zinc-500">
        Connections, branding, and workspace.
      </p>

      <div className="mt-6 max-w-xl rounded-xl border border-white/5 bg-white/[0.02] p-5">
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
          <a
            href="/api/meta/oauth/start"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
          >
            {connected ? "Reconnect" : "Connect"}
          </a>
        </div>
      </div>

      <div className="mt-3 max-w-xl rounded-xl border border-white/5 bg-white/[0.02] p-5">
        <p className="text-sm font-semibold text-zinc-100">
          Branding &amp; delivery
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Logo, accent color, and report sender settings arrive with the
          Reports module (M4/M7).
        </p>
      </div>
    </div>
  );
}
