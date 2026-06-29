import { listInvoices } from "@/lib/actions/invoices";
import { listCounterparties } from "@/lib/actions/clients";
import { loadSettings } from "@/lib/actions/settings";
import InvoicesPage from "@/components/InvoicesPage";

export default async function Invoices() {
  const [invoices, counterparties, settings] = await Promise.all([
    listInvoices(),
    listCounterparties(),
    loadSettings(),
  ]);
  return (
    <InvoicesPage
      initialInvoices={invoices}
      counterparties={counterparties}
      settings={settings}
    />
  );
}
