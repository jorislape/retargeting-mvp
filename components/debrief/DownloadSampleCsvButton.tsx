"use client";

import { SAMPLE_CSV_FILENAME, SAMPLE_CSV_TEXT } from "@/modules/debrief/sampleCsv";

export function DownloadSampleCsvButton({ className }: { className?: string }) {
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_TEXT], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = SAMPLE_CSV_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={downloadSample} className={className}>
      Download sample CSV
    </button>
  );
}
