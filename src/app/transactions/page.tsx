import { auth } from "@/auth";
import { listTransactions } from "@/lib/actions/transactions";
import { redirect } from "next/navigation";
import TransactionsPage from "@/components/TransactionsPage";

export default async function Transactions() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const transactions = await listTransactions();

  return <TransactionsPage transactions={transactions} />;
}
