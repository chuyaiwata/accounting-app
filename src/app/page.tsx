import { auth, signIn, signOut } from "@/auth";
import AddTransactionForm from "@/components/AddTransactionForm";
import TransactionList from "@/components/TransactionList";
import { listTransactions } from "@/lib/actions/transactions";

export default async function Home() {
  const session = await auth();

  // ログイン済みの場合のみ取引を取得
  const transactions = session?.user ? await listTransactions() : [];

  // 今月の集計
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyIncome = transactions
    .filter((t) => t.type === "income" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpense = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0);

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">今月の収入</p>
              <p className="text-2xl font-semibold mt-1">
                ¥{monthlyIncome.toLocaleString()}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">今月の支出</p>
              <p className="text-2xl font-semibold mt-1">
                ¥{monthlyExpense.toLocaleString()}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">今月の差引</p>
              <p className="text-2xl font-semibold mt-1">
                ¥{(monthlyIncome - monthlyExpense).toLocaleString()}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-500">登録件数</p>
              <p className="text-2xl font-semibold mt-1">
                {transactions.length}件
              </p>
            </div>
          </div>

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