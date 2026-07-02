import { EmptyState, PageHeader } from "@/components/ui/kit";

export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Anomalies and account health, checked hourly."
      />
      <div className="mt-6">
        <EmptyState
          title="All quiet."
          description="Spend spikes, CPA deviations, rejected ads, and delivery problems will surface here. This module ships in milestone M6 — it requires the persistence layer for rolling baselines."
        />
      </div>
    </div>
  );
}
