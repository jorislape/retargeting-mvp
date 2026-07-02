export default function AlertsPage() {
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight">Alerts</h1>
      <p className="mt-0.5 text-sm text-zinc-500">
        Anomalies and account health, checked hourly.
      </p>
      <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-10 text-center">
        <p className="text-sm font-medium text-zinc-200">All quiet.</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
          Spend spikes, CPA deviations, rejected ads, and delivery problems
          will surface here. This module ships in milestone M6 — it requires
          the persistence layer for rolling baselines.
        </p>
      </div>
    </div>
  );
}
