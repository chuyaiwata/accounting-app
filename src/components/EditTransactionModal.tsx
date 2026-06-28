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
import { X, Loader2, Paperclip, Upload, Trash2 } from "lucide-react";
import ReceiptPreviewModal from "./ReceiptPreviewModal";

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

  // レシート画像
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(transaction.receiptUrl);
  const [pendingReceipt, setPendingReceipt] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [receiptAction, setReceiptAction] = useState<"add" | "delete" | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Escキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;

    setError(null);
    setReceiptLoading(true);

    let file: Blob = original;
    let mimeType = "image/jpeg";

    const isHeic =
      /\.(heic|heif)$/i.test(original.name) ||
      original.type === "image/heic" ||
      original.type === "image/heif";

    if (isHeic) {
      try {
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({
          blob: original,
          toType: "image/jpeg",
          quality: 0.85,
        });
        file = Array.isArray(converted) ? converted[0] : converted;
      } catch (err) {
        console.error("HEIC conversion error:", err);
        setError("HEIC画像の変換に失敗しました");
        setReceiptLoading(false);
        return;
      }
    } else if (original.type === "image/png") {
      mimeType = "image/png";
    } else if (original.type === "image/webp") {
      mimeType = "image/webp";
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setPendingReceipt({ base64, mimeType, preview: dataUrl });
      setReceiptAction("add");
      setReceiptLoading(false);
    };
    reader.onerror = () => {
      setError("画像の読み込みに失敗しました");
      setReceiptLoading(false);
    };
    reader.readAsDataURL(file);
  }

  function handleDeleteReceipt() {
    if (!confirm("レシート画像を削除します。よろしいですか?")) return;
    setReceiptUrl(undefined);
    setPendingReceipt(null);
    setReceiptAction("delete");
  }

  function handleCancelPending() {
    setPendingReceipt(null);
    setReceiptAction(null);
  }

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

    // レシート画像情報を FormData に追加
    if (receiptAction === "add" && pendingReceipt) {
      formData.set("receiptAction", "add");
      formData.set("receiptBase64", pendingReceipt.base64);
      formData.set("receiptMimeType", pendingReceipt.mimeType);
    } else if (receiptAction === "delete") {
      formData.set("receiptAction", "delete");
    }

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

          {/* レシート画像 */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              レシート画像(電子帳簿保存法対応)
            </label>

            {/* 新規アップロード待機中 */}
            {pendingReceipt && (
              <div className="rounded-lg p-3 mb-2" style={{ background: "var(--bg-overlay)", border: "1px solid var(--accent)" }}>
                <p className="text-[11px] text-[var(--accent)] mb-2">保存時にアップロードされます</p>
                <img src={pendingReceipt.preview} alt="新規レシート" className="max-h-48 rounded mb-2" />
                <button
                  type="button"
                  onClick={handleCancelPending}
                  className="text-xs px-3 py-1.5 rounded text-[var(--text-secondary)]"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  キャンセル
                </button>
              </div>
            )}

            {/* 既存画像あり(差し替えor削除可能) */}
            {!pendingReceipt && receiptUrl && receiptAction !== "delete" && (
              <div className="rounded-lg p-3 mb-2" style={{ background: "var(--bg-overlay)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-xs text-[var(--text-secondary)]">レシート画像が紐付いています</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="text-xs px-3 py-1.5 rounded text-[var(--text-primary)]"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    プレビュー
                  </button>
                  <label
                    className="text-xs px-3 py-1.5 rounded cursor-pointer flex items-center gap-1"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    差し替え
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleDeleteReceipt}
                    className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
                    style={{ background: "var(--bg-elevated)", color: "#f87171" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    削除
                  </button>
                </div>
              </div>
            )}

            {/* 既存画像なし(削除直後含む) */}
            {!pendingReceipt && (!receiptUrl || receiptAction === "delete") && (
              <div>
                {receiptAction === "delete" && (
                  <p className="text-[11px] text-[#f87171] mb-2">保存時に既存画像が削除されます</p>
                )}
                <label
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg cursor-pointer transition"
                  style={{
                    background: "var(--bg-overlay)",
                    border: "1px dashed var(--border-default)",
                  }}
                >
                  {receiptLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />
                  ) : (
                    <Upload className="w-4 h-4 text-[var(--text-tertiary)]" />
                  )}
                  <span className="text-sm text-[var(--text-secondary)]">
                    {receiptLoading ? "読み込み中..." : "レシート画像を追加"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
                    onChange={handleReceiptUpload}
                    className="hidden"
                    disabled={receiptLoading}
                  />
                </label>
              </div>
            )}
          </div>

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

      {/* レシート画像プレビュー */}
      {showPreview && receiptUrl && (
        <ReceiptPreviewModal
          fileId={receiptUrl}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
