import { EmptyState, PageHeader } from "@/components/ui/kit";
import { FileTextIcon } from "@/components/ui/icons";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Scheduled and shared client reports."
      />
      <div className="mt-6">
        <EmptyState
          icon={<FileTextIcon className="h-5 w-5" />}
          title="No reports yet."
          description="Each client gets a live share link, an editable AI summary, and scheduled delivery. Shipping in milestone M4."
        />
      </div>
    </div>
  );
}
