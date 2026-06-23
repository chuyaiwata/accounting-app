import { auth, signIn, signOut } from "@/auth";
import AddTransactionForm from "@/components/AddTransactionForm";
import TransactionList from "@/components/TransactionList";
import { listTransactions } from "@/lib/actions/transactions";

export default async function Home() {
  const session = await auth();
  const transactions = session?.user ? await listTransactions() : [];

  // ---------------------------------------------------------------------------
  // 集計
  // ---------------------------------------------------------------------------
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 通常取引(損益)
  const businessTxns = transactions.filter((t) => t.category === "business");
  const monthlyIncome = businessTxns
    .filter((t) => t.type === "income" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpense = businessTxns
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  // 未払い(支払予定の経費 + 立替金)
  const unpaidAmount = transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.settlementStatus === "unpaid" &&
        (t.category === "business" || t.category === "reimbursable")
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // 未入金(請求済みの売上 + 立替回収待ち)
  const unsettledIncome = transactions
    .filter(
      (t) =>
        t.type === "income" &&
        t.settlementStatus === "unpaid" &&
        (t.category === "business" || t.category === "reimbursable")
    )
    .reduce((sum, t) => sum + t.amount, 0);

  // 未回収の立替金(立替支払い済みだが、相手から回収していない)
  const unreimbursedAmount = transactions
    .filter(
      (t) =>
        t.category === "reimbursable" &&
        t.type === "expense" &&
        t.settlementStatus === "settled"
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const reimbursedAmount = transactions
    .filter(
      (t) =>
        t.category === "reimbursable" &&
        t.type === "income" &&
        t.settlementStatus === "settled"
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const netReimbursable = unreimbursedAmount - reimbursedAmount;

  // 所得控除の年間集計
  const thisYear = String(now.getFullYear());
  const taxDeductibleByType: Record<string, number> = {};
  transactions
    .filter(
      (t) =>
        t.category === "tax_deductible" &&
        t.date.startsWith(thisYear) &&
        t.taxDeductionType
    )
    .forEach((t) => {
      const key = t.taxDeductionType!;
      taxDeductibleByType[key] = (taxDeductibleByType[key] || 0) + t.amount;
    });
  const totalTaxDeductible = Object.values(taxDeductibleByType).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <main className="min-h-screen bg-white text-gray-900 p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">会計アプリ</h1>
          <p className="text-gray-600">個人事業主のためのシンプルな帳簿</p>
        </div>

        {session?.user ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{session.user.name}</p>
              <p className="text-xs text-gray-500">{session.user.email}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50"
              >
                ログアウト
              </button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700"
            >
              Googleでログイン
            </button>
          </form>
        )}
      </div>

      {session?.user ? (
        <>
          {/* 損益サマリー */}
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            今月の損益({thisMonth})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">売上</p>
              <p className="text-2xl font-semibold mt-1 text-green-700">
                ¥{monthlyIncome.toLocaleString()}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">経費</p>
              <p className="text-2xl font-semibold mt-1">
                ¥{monthlyExpense.toLocaleString()}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">差引(粗利)</p>
              <p
                className={
                  "text-2xl font-semibold mt-1 " +
                  (monthlyIncome - monthlyExpense >= 0
                    ? "text-gray-900"
                    : "text-red-700")
                }
              >
                ¥{(monthlyIncome - monthlyExpense).toLocaleString()}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-xs text-gray-500">登録件数(全期間)</p>
              <p className="text-2xl font-semibold mt-1">
                {transactions.length}件
              </p>
            </div>
          </div>

          {/* キャッシュフロー */}
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            キャッシュフロー
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
              <p className="text-xs text-orange-700">未払い合計</p>
              <p className="text-2xl font-semibold mt-1 text-orange-800">
                ¥{unpaidAmount.toLocaleString()}
              </p>
              <p className="text-xs text-orange-600 mt-1">支払う予定の合計</p>
            </div>
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <p className="text-xs text-blue-700">未入金合計</p>
              <p className="text-2xl font-semibold mt-1 text-blue-800">
                ¥{unsettledIncome.toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 mt-1">受け取る予定の合計</p>
            </div>
            <div className="border rounded-lg p-4 bg-purple-50 border-purple-200">
              <p className="text-xs text-purple-700">未回収の立替金</p>
              <p className="text-2xl font-semibold mt-1 text-purple-800">
                ¥{netReimbursable.toLocaleString()}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                立替済みで回収待ち
              </p>
            </div>
          </div>

          {/* 所得控除年間集計 */}
          {totalTaxDeductible > 0 && (
            <>
              <h2 className="text-sm font-medium text-gray-500 mb-3">
                所得控除の年間集計({thisYear}年)
              </h2>
              <div className="border rounded-lg p-4 mb-8 bg-gray-50">
                <p className="text-2xl font-semibold mb-3">
                  ¥{totalTaxDeductible.toLocaleString()}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(taxDeductibleByType).map(([key, value]) => (
                    <div key={key} className="bg-white rounded px-2 py-1">
                      <span className="text-gray-500">
                        {taxDeductionLabel(key)}:
                      </span>{" "}
                      <span className="font-medium">
                        ¥{value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 取引一覧 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">取引一覧</h2>
            <AddTransactionForm />
          </div>

          <TransactionList transactions={transactions} />
        </>
      ) : (
        <div className="border rounded-lg p-12 text-center bg-gray-50">
          <p className="text-gray-700 mb-4">
            Googleアカウントでログインして始めましょう
          </p>
          <p className="text-sm text-gray-500">
            データはあなたのGoogle Driveに保存されます
          </p>
        </div>
      )}
    </main>
  );
}

function taxDeductionLabel(key: string): string {
  const labels: Record<string, string> = {
    health_insurance: "国保",
    national_pension: "年金",
    small_business_mutual: "iDeCo・共済",
    life_insurance: "生命保険",
    earthquake_insurance: "地震保険",
    medical_expense: "医療費",
    donation: "寄附金",
    other: "その他",
  };
  return labels[key] || key;
}