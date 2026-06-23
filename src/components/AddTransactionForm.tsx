"use client";

import { useState, useTransition } from "react";
import { addTransaction } from "@/lib/actions/transactions";
import type {
  TransactionCategory,
  TransactionType,
  TaxDeductionType,
  SettlementStatus,
} from "@/lib/types";

interface CategoryOption {
  value: TransactionCategory;
  label: string;
  description: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    value: "business",
    label: "通常取引",
    description: "売上・経費(損益計算書に反映)",
  },
  {
    value: "reimbursable",
    label: "立替金",
    description: "コート代などの立替/回収(損益に影響なし)",
  },
  {
    value: "private_drawing",
    label: "事業主貸",
    description: "事業のお金で個人の支払い(食費・娯楽費等)",
  },
  {
    value: "private_contribution",
    label: "事業主借",
    description: "個人のお金を事業に入れる",
  },
  {
    value: "tax_deductible",
    label: "所得控除",
    description: "国保・年金・医療費・寄附等(確定申告で控除)",
  },
  {
    value: "fixed_asset",
    label: "固定資産購入",
    description: "PC等の高額機材(30万円未満は一括経費)",
  },
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

export default function AddTransactionForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [category, setCategory] = useState<TransactionCategory>("business");
  const [type, setType] = useState<TransactionType>("expense");
  const [settlementStatus, setSettlementStatus] =
    useState<SettlementStatus>("settled");

  const today = new Date().toISOString().slice(0, 10);

  function resetForm() {
    setCategory("business");
    setType("expense");
    setSettlementStatus("settled");
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addTransaction(formData);
      if (result.ok) {
        resetForm();
        setOpen(false);
      } else {
        setError(result.error || "保存に失敗しました");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700"
      >
        + 取引を追加
      </button>
    );
  }

  const isReimbursable = category === "reimbursable";
  const isPrivate =
    category === "private_drawing" || category === "private_contribution";
  const isTaxDeductible = category === "tax_deductible";
  const isFixedAsset = category === "fixed_asset";

  function getDefaultType(cat: TransactionCategory): TransactionType {
    switch (cat) {
      case "private_contribution":
        return "income";
      case "private_drawing":
      case "tax_deductible":
      case "fixed_asset":
        return "expense";
      default:
        return type;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg my-8">
        <div className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-lg">
          <h2 className="text-lg font-semibold">取引を追加</h2>
          <button
            onClick={() => {
              resetForm();
              setOpen(false);
            }}
            className="text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <form action={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-2">
              取引の種類 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setCategory(opt.value);
                    setType(getDefaultType(opt.value));
                  }}
                  className={
                    "text-left p-2 border rounded-md text-xs transition " +
                    (category === opt.value
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-400")
                  }
                >
                  <div className="font-medium text-sm text-gray-900">
                    {opt.label}
                  </div>
                  <div className="text-gray-500 mt-0.5">{opt.description}</div>
                </button>
              ))}
            </div>
            <input type="hidden" name="category" value={category} />
          </div>

          {category === "business" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                収入 / 支出 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={
                    "flex-1 px-3 py-2 border rounded-md text-sm " +
                    (type === "expense"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200")
                  }
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={
                    "flex-1 px-3 py-2 border rounded-md text-sm " +
                    (type === "income"
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-gray-200")
                  }
                >
                  収入
                </button>
              </div>
            </div>
          )}
          <input type="hidden" name="type" value={getDefaultType(category)} />

          {isTaxDeductible && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                控除の種類 <span className="text-red-500">*</span>
              </label>
              <select
                name="taxDeductionType"
                required
                className="w-full border rounded-md px-3 py-2 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  選択してください
                </option>
                {TAX_DEDUCTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isReimbursable && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                立替の動き <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={
                    "flex-1 px-3 py-2 border rounded-md text-sm " +
                    (type === "expense"
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200")
                  }
                >
                  立替(支払った)
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={
                    "flex-1 px-3 py-2 border rounded-md text-sm " +
                    (type === "income"
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-gray-200")
                  }
                >
                  回収(受け取った)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                日付 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                defaultValue={today}
                required
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                金額 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="amount"
                placeholder="0"
                min="1"
                step="1"
                required
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              内容 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="description"
              placeholder={
                isReimbursable
                  ? "例: コート代立替(○○様)"
                  : isFixedAsset
                  ? "例: MacBook Air M3"
                  : isPrivate
                  ? "例: 食費"
                  : isTaxDeductible
                  ? "例: 国民健康保険料 7月分"
                  : "例: スターバックス 渋谷店"
              }
              required
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {(category === "business" || isReimbursable) && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  決済状態
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlementStatus("settled")}
                    className={
                      "flex-1 px-3 py-2 border rounded-md text-sm " +
                      (settlementStatus === "settled"
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200")
                    }
                  >
                    {type === "income" ? "入金済み" : "支払済み"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementStatus("unpaid")}
                    className={
                      "flex-1 px-3 py-2 border rounded-md text-sm " +
                      (settlementStatus === "unpaid"
                        ? "border-orange-600 bg-orange-50 text-orange-700"
                        : "border-gray-200")
                    }
                  >
                    {type === "income" ? "未入金" : "未払い"}
                  </button>
                </div>
                <input
                  type="hidden"
                  name="settlementStatus"
                  value={settlementStatus}
                />
              </div>

              {settlementStatus === "unpaid" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {type === "income" ? "入金予定日" : "支払予定日"}
                  </label>
                  <input
                    type="date"
                    name="expectedSettlementDate"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              )}
            </>
          )}

          {(category === "business" ||
            isReimbursable ||
            isPrivate ||
            isTaxDeductible ||
            isFixedAsset) && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                決済方法
              </label>
              <select
                name="paymentMethod"
                defaultValue=""
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">未選択</option>
                <option value="現金">現金</option>
                <option value="三菱UFJ銀行">三菱UFJ銀行</option>
                <option value="三菱UFJニコス">三菱UFJニコス</option>
                <option value="Heart One">Heart One(家賃用)</option>
                <option value="PayPay">PayPay</option>
                <option value="Suica">Suica</option>
                <option value="ハチペイ">ハチペイ</option>
                <option value="その他">その他</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              メモ(任意)
            </label>
            <textarea
              name="note"
              rows={2}
              placeholder="税務調査時の説明用に詳細を書いておくと安心"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
              className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
              disabled={isPending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}