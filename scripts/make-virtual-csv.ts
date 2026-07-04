/* Dev helper (not shipped): builds a virtual CSV from fixture rows so
   the end-to-end flow can be exercised without a Meta login. */
import { insightsToCsv } from "../modules/meta/insightsToCsv.ts";
import type { AdInsightRow } from "../modules/meta/types.ts";

const base: Omit<AdInsightRow, "adName" | "spend" | "purchaseRoas" | "purchaseValue" | "purchases"> = {
  impressions: "10000",
  linkClicks: "200",
  ctr: "2.0",
  cpc: "1.1",
  costPerPurchase: "15.00",
  leads: "",
  costPerLead: "",
  dateStart: "2026-06-03",
  dateStop: "2026-07-02",
};

const rows: AdInsightRow[] = [
  { ...base, adName: `UGC — "Lina's before, after" hook 🚀🔥,\n15s cut, v2`, spend: "412.55", purchases: "31", purchaseValue: "1989.40", purchaseRoas: "4.82" },
  { ...base, adName: "UGC - Marta routine POV", spend: "388.10", purchases: "28", purchaseValue: "1672.70", purchaseRoas: "4.31" },
  { ...base, adName: "Video - 15s demo hook v2", spend: "344.20", purchases: "22", purchaseValue: "1256.30", purchaseRoas: "3.65" },
  { ...base, adName: "Video - Founder story 30s", spend: "205.90", purchases: "5", purchaseValue: "292.40", purchaseRoas: "1.42" },
  { ...base, adName: "Static - Lifestyle flatlay", spend: "214.80", purchases: "6", purchaseValue: "366.20", purchaseRoas: "1.71" },
  { ...base, adName: "Static - Discount banner 25%", spend: "228.65", purchases: "8", purchaseValue: "445.90", purchaseRoas: "1.95" },
  { ...base, adName: "Static - Ingredient callout", spend: "251.75", purchases: "12", purchaseValue: "675.10", purchaseRoas: "2.68" },
  { ...base, adName: "Tiny test ad (below gate)", spend: "4.10", purchases: "0", purchaseValue: "", purchaseRoas: "" },
];

process.stdout.write(insightsToCsv(rows, "EUR"));
