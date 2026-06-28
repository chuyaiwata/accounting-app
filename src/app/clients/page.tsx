import { listCounterparties } from "@/lib/actions/clients";
import ClientsPage from "@/components/ClientsPage";

export default async function Clients() {
  const counterparties = await listCounterparties();
  return <ClientsPage initialCounterparties={counterparties} />;
}
