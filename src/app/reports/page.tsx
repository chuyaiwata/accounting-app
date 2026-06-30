import { getProfitLoss, getBalanceSheet, getTrialBalance } from "@/lib/actions/journalReports";
import { ReportsPage } from "@/components/ReportsPage";

export const dynamic = "force-dynamic";

export default async function Reports() {
  const pl = await getProfitLoss(2026);
  const bs = await getBalanceSheet(2026);
  const tb = await getTrialBalance(2026);
  return <ReportsPage initialPL={pl} initialBS={bs} initialTB={tb} />;
}
