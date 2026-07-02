import { EmptyState, PageHeader } from "@/components/ui/kit";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Scheduled and shared client reports."
      />
      <div className="mt-6">
        <EmptyState
          title="No reports yet."
          description="Reports are generated per client with an editable AI summary, a live share link, and scheduled delivery. This module ships in milestone M4 — it requires the persistence layer (see ARCHITECTURE.md)."
        />
      </div>
    </div>
  );
}
