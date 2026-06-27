"use client";

import { useState, useTransition, useEffect } from "react";
import { updateTransaction } from "@/lib/actions/transactions";
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
  TaxDeductionType,
  SettlementStatus,
} from "@/lib/types";
import { EXPENSE_ACCOUNTS, INCOME_ACCOUNTS } from "@/lib/data/accountOptions";
import { X, Loader2 } from "lucide-react";

const CATEGORY_OPTIONS: { value: TransactionCategory; label: string }[] = [
  { value: "business", label: "通常取引" },
  { value: "reimbursable", label: "立替金" },
  { value: "private_drawing", label: "事業主貸" },
  { value: "private_contribution", label: "事業主借" },
  { value: "tax_deductible", label: "所得控除" },
  { value: "fixed_asset", label: "固定資産購入" },
];

const TAX_DEDUCTION_OPTIONS: { value: TaxDeductionType; label: string }[] = [
  { value: "health_insurance", label: "国民健康保険料" },
  { value: "national_pension", label: "国民年金保険料" },
  { value: "small_business_mutual", label: "iDeCo・小規模企業共済" },
  { value: "life_insurance", label: "生命保険料" },
  { value: "earthquake_insurance", label: "地震保険料" },
  { value: "medical_expense", label: "医療費" },
  { value: "donation", label: "寄附金(ふるさと納税等)" },
  { value: "other", label: "その他" },
];

const TAGS = [
  { id: "pbs4", name: "PBS4", color: "#4f8bff" },
  { id: "upcycle", name: "アップサイクル", color: "#34d399" },
  { id: "event", name: "イベント", color: "#fbbf24" },
  { id: "common", name: "共通", color: "#7a7f8c" },
];

interface Props {
  transaction: Transaction;
  onClose: () => void;
}

export default function EditTransactionModal({ transaction, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<TransactionCategory>(transaction.category);
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [settlementStatus, setSettlementStatus] = useState<SettlementStatus>(transaction.settlementStatus);
  const [selectedTags, setSelectedTags] = useState<string[]>(transaction.tagIds || []);
  const [accountCode, setAccountCode] = useState<string>(transaction.accountCode || "");
  const [taxDeductionType, setTaxDeductionType] = useState<TaxDeductionType | "">(
    transaction.taxDeductionType || ""
  );

  // Escキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = (formData: FormData) => {
    setError(null);

    // state から FormData にセット
    formData.set("category", category);
    formData.set("type", type);
    formData.set("settlementStatus", settlementStatus);
    formData.set("accountCode", accountCode);
    if (taxDeductionType) {
      formData.set("taxDeductionType", taxDeductionType);
    }
    formData.delete("tagIds");
    selectedTags.forEach((tag) => formData.append("tagIds", tag));

    startTransition(async () => {
      const result = await updateTransaction(transaction.id, formData);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error || "更新に失敗しました");
      }
    });
  };

  const isBusiness = category === "business" || category === "reimbursable";
  const isTaxDeductible = category === "tax_deductible";
  const isFixedAsset = category === "fixed_asset";
  const showAccountCode = isBusiness || isFixedAsset;
  const showSettlement = isBusiness;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-0 md:p-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-2xl rounded-none md:rounded-2xl my-0 md:my-8"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase">
              編集
            </p>
            <h2 className="text-lg font-semibold">取引を編集</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form action={handleSubmit} className="px-6 py-5 space-y-5">
          {/* カテゴリ */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              区分
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TransactionCategory)}
              className="w-full px-3 py-2.5 text-sm"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 収入/支出 */}
          {(isBusiness || isFixedAsset) && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                収入 / 支出
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background:
                      type === "expense"
                        ? "var(--text-primary)"
                        : "var(--bg-overlay)",
                    color:
                      type === "expense"
                        ? "var(--bg-base)"
                        : "var(--text-secondary)",
                  }}
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background:
                      type === "income"
                        ? "var(--text-primary)"
                        : "var(--bg-overlay)",
                    color:
                      type === "income"
                        ? "var(--bg-base)"
                        : "var(--text-secondary)",
                  }}
                >
                  収入
                </button>
              </div>
            </div>
          )}

          {/* 日付 / 金額 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                日付
              </label>
              <input
                type="date"
                name="date"
                defaultValue={transaction.date}
                required
                className="w-full px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                金額
              </label>
              <input
                type="number"
                name="amount"
                defaultValue={transaction.amount}
                min="1"
                step="1"
                required
                className="w-full px-3 py-2.5 text-sm tabular"
              />
            </div>
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              内容
            </label>
            <input
              type="text"
              name="description"
              defaultValue={transaction.description}
              required
              className="w-full px-3 py-2.5 text-sm"
            />
          </div>

          {/* 勘定科目 */}
          {showAccountCode && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                勘定科目
              </label>
              <select
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                className="w-full px-3 py-2.5 text-sm"
              >
                <option value="">未選択</option>
                {type === "income"
                  ? INCOME_ACCOUNTS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))
                  : EXPENSE_ACCOUNTS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
              </select>
            </div>
          )}

          {/* 所得控除タイプ */}
          {isTaxDeductible && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                控除タイプ
              </label>
              <select
                value={taxDeductionType}
                onChange={(e) => setTaxDeductionType(e.target.value as TaxDeductionType)}
                className="w-full px-3 py-2.5 text-sm"
              >
                <option value="">未選択</option>
                {TAX_DEDUCTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 事業タグ */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              事業タグ(複数選択可)
            </label>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="text-xs px-3 py-1.5 rounded-md font-medium transition"
                    style={{
                      background: active ? `${tag.color}25` : "var(--bg-overlay)",
                      color: active ? tag.color : "var(--text-secondary)",
                      border: `1px solid ${active ? tag.color : "transparent"}`,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 決済状況 */}
          {showSettlement && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                決済状況
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettlementStatus("settled")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background:
                      settlementStatus === "settled"
                        ? "var(--text-primary)"
                        : "var(--bg-overlay)",
                    color:
                      settlementStatus === "settled"
                        ? "var(--bg-base)"
                        : "var(--text-secondary)",
                  }}
                >
                  決済済み
                </button>
                <button
                  type="button"
                  onClick={() => setSettlementStatus("unpaid")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background:
                      settlementStatus === "unpaid"
                        ? "var(--text-primary)"
                        : "var(--bg-overlay)",
                    color:
                      settlementStatus === "unpaid"
                        ? "var(--bg-base)"
                        : "var(--text-secondary)",
                  }}
                >
                  未決済
                </button>
              </div>
              {settlementStatus === "unpaid" && (
                <div className="mt-3">
                  <label className="block text-[10px] text-[var(--text-tertiary)] mb-1">
                    決済予定日
                  </label>
                  <input
                    type="date"
                    name="expectedSettlementDate"
                    defaultValue={transaction.expectedSettlementDate || ""}
                    className="w-full px-3 py-2.5 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* 決済方法 */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              決済方法(任意)
            </label>
            <input
              type="text"
              name="paymentMethod"
              defaultValue={transaction.paymentMethod || ""}
              placeholder="例: 現金、ニコス、Suica"
              className="w-full px-3 py-2.5 text-sm"
            />
          </div>

          {/* メモ */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              メモ(任意)
            </label>
            <textarea
              name="note"
              defaultValue={transaction.note || ""}
              rows={2}
              className="w-full px-3 py-2.5 text-sm"
            />
          </div>

          {/* エラー */}
          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: "rgba(248, 113, 113, 0.1)",
                color: "#f87171",
                border: "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              {error}
            </div>
          )}

          {/* 保存/キャンセル */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition"
              style={{
                background: "var(--bg-overlay)",
                color: "var(--text-secondary)",
              }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "var(--accent)",
                color: "white",
              }}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
