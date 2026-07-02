import { EmptyState, PageHeader } from "@/components/ui/kit";
import { BellIcon } from "@/components/ui/icons";

export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Anomalies and account health, checked hourly."
      />
      <div className="mt-6">
        <EmptyState
          icon={<BellIcon className="h-5 w-5" />}
          title="All quiet."
          description="Spend spikes, CPA deviations, rejected ads, and delivery problems will surface here. Shipping in milestone M6."
        />
      </div>
    </div>
  );
}
