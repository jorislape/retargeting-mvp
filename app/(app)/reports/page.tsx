export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight">Reports</h1>
      <p className="mt-0.5 text-sm text-zinc-500">
        Scheduled and shared client reports.
      </p>
      <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-10 text-center">
        <p className="text-sm font-medium text-zinc-200">No reports yet.</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
          Reports are generated per client with an editable AI summary, a live
          share link, and scheduled delivery. This module ships in milestone
          M4 — it requires the persistence layer (see ARCHITECTURE.md).
        </p>
      </div>
    </div>
  );
}
