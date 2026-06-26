"use client";

import { useTransition } from "react";
import {
  settleTransaction,
  deleteTransaction,
} from "@/lib/actions/transactions";
import type { Transaction, TransactionCategory } from "@/lib/types";
import { Check, Trash2, AlertTriangle } from "lucide-react";

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

const CATEGORY_COLORS: Record<TransactionCategory, { bg: string; text: string }> = {
  business: { bg: "rgba(180, 184, 196, 0.1)", text: "#b4b8c4" },
  reimbursable: { bg: "rgba(192, 132, 252, 0.15)", text: "#c084fc" },
  private_drawing: { bg: "rgba(251, 191, 36, 0.15)", text: "#fbbf24" },
  private_contribution: { bg: "rgba(251, 191, 36, 0.15)", text: "#fbbf24" },
  tax_deductible: { bg: "rgba(79, 139, 255, 0.15)", text: "#4f8bff" },
  fixed_asset: { bg: "rgba(34, 211, 238, 0.15)", text: "#22d3ee" },
  prepaid: { bg: "rgba(236, 72, 153, 0.15)", text: "#ec4899" },
  inventory: { bg: "rgba(20, 184, 166, 0.15)", text: "#14b8a6" },
  loan: { bg: "rgba(248, 113, 113, 0.15)", text: "#f87171" },
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
      <div
        className="rounded-xl p-12 text-center"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <p className="text-sm text-[var(--text-secondary)] mb-2">
          取引がまだ登録されていません
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          上の「取引を追加」ボタンから最初の取引を記録しましょう
        </p>
      </div>
    );
  }

  return (
    <>
      {/* モバイル: カード形式 */}
      <div className="md:hidden space-y-2">
        {transactions.map((t) => {
          const isUnpaid = t.settlementStatus === "unpaid";
          const today = new Date().toISOString().slice(0, 10);
          const isOverdue =
            isUnpaid &&
            t.expectedSettlementDate &&
            t.expectedSettlementDate < today;
          const catColor = CATEGORY_COLORS[t.category];
          return (
            <div
              key={t.id}
              className="rounded-xl p-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block text-[10px] font-medium px-2 py-0.5 rounded"
                    style={{ background: catColor.bg, color: catColor.text }}
                  >
                    {CATEGORY_LABELS[t.category]}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)] tabular">
                    {t.date}
                  </span>
                </div>
                <p
                  className="tabular text-base font-semibold"
                  style={{
                    color: t.type === "income" ? "#34d399" : "var(--text-primary)",
                  }}
                >
                  {t.type === "income" ? "+" : "−"}¥{t.amount.toLocaleString()}
                </p>
              </div>

              <div className="text-sm text-[var(--text-primary)] mb-1">
                {t.description}
              </div>
              {t.note && (
                <div className="text-[10px] text-[var(--text-tertiary)] mb-2">
                  {t.note}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {t.paymentMethod && (
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {t.paymentMethod}
                    </span>
                  )}
                  {isUnpaid ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{
                        background: isOverdue
                          ? "rgba(248, 113, 113, 0.15)"
                          : "rgba(251, 191, 36, 0.15)",
                        color: isOverdue ? "#f87171" : "#fbbf24",
                      }}
                    >
                      {isOverdue && <AlertTriangle className="w-2.5 h-2.5" />}
                      {t.type === "income" ? "未入金" : "未払い"}
                      {t.expectedSettlementDate && (
                        <span className="opacity-70">
                          {t.expectedSettlementDate.slice(5)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{
                        background: "rgba(52, 211, 153, 0.12)",
                        color: "#34d399",
                      }}
                    >
                      <Check className="w-2.5 h-2.5" />
                      {t.type === "income" ? "入金済" : "決済済"}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {isUnpaid && (
                    <button
                      onClick={() => handleSettle(t.id)}
                      disabled={isPending}
                      className="text-[10px] px-2 py-1 rounded disabled:opacity-50"
                      style={{
                        background: "var(--bg-overlay)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      決済済
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(t.id, t.description)}
                    disabled={isPending}
                    className="p-1.5 rounded disabled:opacity-50"
                    style={{ color: "var(--text-tertiary)" }}
                    aria-label="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PC: テーブル形式 */}
      <div
        className="hidden md:block rounded-xl overflow-x-auto"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bg-overlay)" }}>
              <th className="text-left px-4 py-3 font-medium text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">
                日付
              </th>
              <th className="text-left px-3 py-3 font-medium text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">
                区分
              </th>
              <th className="text-left px-3 py-3 font-medium text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">
                内容
              </th>
              <th className="text-left px-3 py-3 font-medium text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">
                決済方法
              </th>
              <th className="text-left px-3 py-3 font-medium text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">
                状態
              </th>
              <th className="text-right px-3 py-3 font-medium text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">
                金額
              </th>
              <th className="text-center px-4 py-3 font-medium text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide whitespace-nowrap">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, idx) => {
              const isUnpaid = t.settlementStatus === "unpaid";
              const today = new Date().toISOString().slice(0, 10);
              const isOverdue =
                isUnpaid &&
                t.expectedSettlementDate &&
                t.expectedSettlementDate < today;
              const catColor = CATEGORY_COLORS[t.category];
              return (
                <tr
                  key={t.id}
                  className="transition hover:bg-[var(--bg-hover)]"
                  style={{
                    borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                  }}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--text-secondary)] tabular text-xs">
                    {t.date}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className="inline-block text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{ background: catColor.bg, color: catColor.text }}
                    >
                      {CATEGORY_LABELS[t.category]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-[var(--text-primary)] text-sm">{t.description}</div>
                    {t.note && (
                      <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        {t.note}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                    {t.paymentMethod || "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {isUnpaid ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{
                          background: isOverdue
                            ? "rgba(248, 113, 113, 0.15)"
                            : "rgba(251, 191, 36, 0.15)",
                          color: isOverdue ? "#f87171" : "#fbbf24",
                        }}
                      >
                        {isOverdue && <AlertTriangle className="w-2.5 h-2.5" />}
                        {t.type === "income" ? "未入金" : "未払い"}
                        {t.expectedSettlementDate && (
                          <span className="opacity-70 ml-0.5">
                            {t.expectedSettlementDate.slice(5)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{
                          background: "rgba(52, 211, 153, 0.12)",
                          color: "#34d399",
                        }}
                      >
                        <Check className="w-2.5 h-2.5" />
                        {t.type === "income" ? "入金済" : "決済済"}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-3 py-3 text-right whitespace-nowrap font-medium tabular text-sm"
                    style={{
                      color:
                        t.type === "income"
                          ? "#34d399"
                          : "var(--text-primary)",
                    }}
                  >
                    {t.type === "income" ? "+" : "−"}¥
                    {t.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex gap-1 justify-end">
                      {isUnpaid && (
                        <button
                          onClick={() => handleSettle(t.id)}
                          disabled={isPending}
                          className="text-[11px] px-2 py-1 rounded transition disabled:opacity-50"
                          style={{
                            background: "var(--bg-overlay)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-default)",
                          }}
                        >
                          決済済にする
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t.id, t.description)}
                        disabled={isPending}
                        className="p-1.5 rounded transition disabled:opacity-50 hover:bg-[var(--color-danger-bg)]"
                        style={{ color: "var(--text-tertiary)" }}
                        aria-label="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
