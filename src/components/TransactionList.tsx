import type { Transaction } from "@/lib/types";

interface Props {
  transactions: Transaction[];
}

export default function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center bg-gray-50">
        <p className="text-gray-700 mb-2">取引がまだ登録されていません</p>
        <p className="text-sm text-gray-500">
          上の「取引を追加」ボタンから最初の取引を記録しましょう
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left px-4 py-2 font-normal">日付</th>
            <th className="text-left px-4 py-2 font-normal">内容</th>
            <th className="text-left px-4 py-2 font-normal">種別</th>
            <th className="text-right px-4 py-2 font-normal">金額</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="px-4 py-3">{t.date}</td>
              <td className="px-4 py-3">
                <div>{t.description}</div>
                {t.note && (
                  <div className="text-xs text-gray-500 mt-0.5">{t.note}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    t.type === "income"
                      ? "text-green-700"
                      : "text-gray-700"
                  }
                >
                  {t.type === "income" ? "収入" : "支出"}
                </span>
              </td>
              <td
                className={
                  "px-4 py-3 text-right font-medium " +
                  (t.type === "income" ? "text-green-700" : "text-gray-900")
                }
              >
                {t.type === "income" ? "+" : "-"}¥{t.amount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}