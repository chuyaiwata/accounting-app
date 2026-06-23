"use client";

import { useTransition } from "react";
import {
  settleTransaction,
  deleteTransaction,
} from "@/lib/actions/transactions";
import type { Transaction, TransactionCategory } from "@/lib/types";

interface Props {
  transactions: Transaction[];
}

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  business: "通常",
  reimbursable: "立替",
  private_drawing: "事業主貸",
  private_contribution: "事業主借",
  tax_deductible: "所得控除",
  fixed_asset: "固定資産",
  prepaid: "前払/前受",
  inventory: "在庫",
  loan: "借入",
};

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  business: "bg-gray-100 text-gray-700",
  reimbursable: "bg-purple-100 text-purple-700",
  private_drawing: "bg-yellow-100 text-yellow-700",
  private_contribution: "bg-yellow-100 text-yellow-700",
  tax_deductible: "bg-indigo-100 text-indigo-700",
  fixed_asset: "bg-sky-100 text-sky-700",
  prepaid: "bg-pink-100 text-pink-700",
  inventory: "bg-teal-100 text-teal-700",
  loan: "bg-red-100 text-red-700",
};

export default function TransactionList({ transactions }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSettle(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    startTransition(async () => {
      const result = await settleTransaction(id, today);
      if (!result.ok) {
        alert(result.error || "決済処理に失敗しました");
      }
    });
  }

  function handleDelete(id: string, description: string) {
    if (!confirm(`「${description}」を削除しますか?\nこの操作は取り消せません。`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTransaction(id);
      if (!result.ok) {
        alert(result.error || "削除に失敗しました");
      }
    });
  }

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
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left px-3 py-2 font-normal whitespace-nowrap">
              日付
            </th>
            <th className="text-left px-3 py-2 font-normal whitespace-nowrap">
              区分
            </th>
            <th className="text-left px-3 py-2 font-normal">内容</th>
            <th className="text-left px-3 py-2 font-normal whitespace-nowrap">
              決済方法
            </th>
            <th className="text-left px-3 py-2 font-normal whitespace-nowrap">
              状態
            </th>
            <th className="text-right px-3 py-2 font-normal whitespace-nowrap">
              金額
            </th>
            <th className="text-center px-3 py-2 font-normal whitespace-nowrap">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const isUnpaid = t.settlementStatus === "unpaid";
            const isOverdue =
              isUnpaid &&
              t.expectedSettlementDate &&
              t.expectedSettlementDate 
                new Date().toISOString().slice(0, 10);
            return (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-3 whitespace-nowrap text-gray-700">
                  {t.date}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span
                    className={
                      "inline-block text-xs px-2 py-0.5 rounded " +
                      CATEGORY_COLORS[t.category]
                    }
                  >
                    {CATEGORY_LABELS[t.category]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="text-gray-900">{t.description}</div>
                  {t.note && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t.note}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-gray-600">
                  {t.paymentMethod || "—"}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {isUnpaid ? (
                    <span
                      className={
                        "inline-block text-xs px-2 py-0.5 rounded " +
                        (isOverdue
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700")
                      }
                    >
                      {t.type === "income" ? "未入金" : "未払い"}
                      {t.expectedSettlementDate && (
                        <span className="ml-1">
                          ({t.expectedSettlementDate})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-block text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                      {t.type === "income" ? "入金済" : "決済済"}
                    </span>
                  )}
                </td>
                <td
                  className={
                    "px-3 py-3 text-right font-medium whitespace-nowrap " +
                    (t.type === "income" ? "text-green-700" : "text-gray-900")
                  }
                >
                  {t.type === "income" ? "+" : "-"}¥
                  {t.amount.toLocaleString()}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-center">
                  <div className="flex gap-1 justify-center">
                    {isUnpaid && (
                      <button
                        onClick={() => handleSettle(t.id)}
                        disabled={isPending}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        決済済にする
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(t.id, t.description)}
                      disabled={isPending}
                      className="text-xs px-2 py-1 border rounded text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                      aria-label="削除"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}