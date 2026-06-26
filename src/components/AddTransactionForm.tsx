"use client";

import { useState, useTransition, useRef } from "react";
import { addTransaction } from "@/lib/actions/transactions";
import type {
  TransactionCategory,
  TransactionType,
  TaxDeductionType,
  SettlementStatus,
} from "@/lib/types";
import { parseReceiptWithClaude } from "@/lib/actions/parseReceiptWithClaude";
import { EXPENSE_ACCOUNTS, INCOME_ACCOUNTS } from "@/lib/data/accountOptions";
import { Plus, X, Camera, Loader2 } from "lucide-react";

interface CategoryOption {
  value: TransactionCategory;
  label: string;
  description: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "business", label: "通常取引", description: "売上・経費(損益に反映)" },
  { value: "reimbursable", label: "立替金", description: "コート代などの立替/回収" },
  { value: "private_drawing", label: "事業主貸", description: "事業のお金で個人の支払い" },
  { value: "private_contribution", label: "事業主借", description: "個人のお金を事業に入れる" },
  { value: "tax_deductible", label: "所得控除", description: "国保・年金・医療費・寄附等" },
  { value: "fixed_asset", label: "固定資産購入", description: "PC等の高額機材" },
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

export default function AddTransactionForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [category, setCategory] = useState<TransactionCategory>("business");
  const [type, setType] = useState<TransactionType>("expense");
  const [settlementStatus, setSettlementStatus] = useState<SettlementStatus>("settled");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // OCR関連state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{
    amount: string;
    date: string;
    description: string;
    accountCode: string;
  } | null>(null);
  const [accountCode, setAccountCode] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // フォームのkey(OCR結果を反映させるためにフォームを再マウントする)
  const [formKey, setFormKey] = useState(0);

  const today = new Date().toISOString().slice(0, 10);

  function resetForm() {
    setCategory("business");
    setType("expense");
    setSettlementStatus("settled");
    setSelectedTags([]);
    setError(null);
    setOcrPreview(null);
    setOcrResult(null);
    setOcrProgress(0);
    setAccountCode("");
    setFormKey((k) => k + 1);
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;

    setError(null);
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrResult(null);

    let file: Blob = original;

    // HEIC/HEIF → JPEG 変換(iPhoneのデフォルト形式対応)
    const isHeic =
      /\.(heic|heif)$/i.test(original.name) ||
      original.type === "image/heic" ||
      original.type === "image/heif";

    if (isHeic) {
      try {
        setOcrProgress(10);
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({
          blob: original,
          toType: "image/jpeg",
          quality: 0.85,
        });
        file = Array.isArray(converted) ? converted[0] : converted;
      } catch (err) {
        console.error("HEIC conversion error:", err);
        setError("HEIC画像の変換に失敗しました。");
        setOcrLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (ev) => setOcrPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setOcrProgress(30);

    // 画像が大きすぎる場合は縮小(Claude APIの上限考慮)
    let uploadFile: Blob = file;
    try {
      uploadFile = await resizeIfNeeded(file);
    } catch (err) {
      console.warn("Resize failed, using original:", err);
    }

    setOcrProgress(50);

    // Blob → base64
    const base64 = await blobToBase64(uploadFile);
    const mediaType = "image/jpeg";

    setOcrProgress(70);

    try {
      const result = await parseReceiptWithClaude(base64, mediaType);

      if (!result.ok) {
        setError(result.error || "レシートの読み取りに失敗しました");
        setOcrLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      console.log("Claude OCR result:", result);

      setOcrProgress(100);

      // フォームに反映
      setOcrResult({
        amount: result.amount?.toString() || "",
        date: result.date || today,
        description:
          result.description ||
          result.storeName ||
          "",
        accountCode: result.accountCode || "",
      });
      if (result.accountCode) {
        setAccountCode(result.accountCode);
      }

      // タグ自動付与
      if (result.tagIds.length > 0) {
        setSelectedTags((prev) => {
          const merged = new Set([...prev, ...result.tagIds]);
          return Array.from(merged);
        });
      }

      // カテゴリ確定(支出)
      setCategory("business");
      setType("expense");

      // フォーム再マウントでdefaultValue更新
      setFormKey((k) => k + 1);
    } catch (err) {
      console.error("OCR error:", err);
      setError(
        "レシートの読み取りに失敗しました。手動で入力してください。"
      );
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ヘルパー: Blob → base64文字列(プレフィックスなし)
  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ヘルパー: 画像が大きすぎる場合は縮小
  async function resizeIfNeeded(blob: Blob, maxDim = 1600): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        if (width <= maxDim && height <= maxDim) {
          resolve(blob);
          return;
        }

        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (out) => {
            if (out) resolve(out);
            else reject(new Error("Canvas toBlob failed"));
          },
          "image/jpeg",
          0.9
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };
      img.src = url;
    });
  }

    function handleSubmit(formData: FormData) {
    setError(null);
    selectedTags.forEach((tagId) => formData.append("tagIds", tagId));
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
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition hover:opacity-90"
        style={{ background: "var(--accent)", color: "white" }}
      >
        <Plus className="w-4 h-4" />
        取引を追加
      </button>
    );
  }

  const isReimbursable = category === "reimbursable";
  const isPrivate = category === "private_drawing" || category === "private_contribution";
  const isTaxDeductible = category === "tax_deductible";
  const isFixedAsset = category === "fixed_asset";
  const showTags = category === "business" || isReimbursable || isFixedAsset;

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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-y-auto"
      style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="rounded-2xl w-full max-w-xl my-8"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between sticky top-0 rounded-t-2xl z-10"
          style={{
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <h2 className="text-base font-semibold">取引を追加</h2>
          <button
            onClick={() => { resetForm(); setOpen(false); }}
            className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* レシート読取ボタン */}
        <div className="px-6 pt-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
            onChange={handleReceiptUpload}
            className="hidden"
            id="receipt-upload"
          />
          {!ocrLoading && !ocrPreview && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition"
              style={{
                background: "var(--bg-overlay)",
                color: "var(--text-primary)",
                border: "1px dashed var(--border-default)",
              }}
            >
              <Camera className="w-4 h-4" />
              レシートを撮影 / 選択
            </button>
          )}
          {ocrLoading && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: "var(--bg-overlay)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--accent)" }} />
                <span className="text-[var(--text-secondary)]">
                  読み取り中... {ocrProgress}%
                </span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--bg-base)" }}
              >
                <div
                  className="h-full transition-all"
                  style={{ width: `${ocrProgress}%`, background: "var(--accent)" }}
                />
              </div>
            </div>
          )}
          {ocrPreview && !ocrLoading && (
            <div className="flex gap-3 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ocrPreview}
                alt="レシート"
                className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                style={{ border: "1px solid var(--border-default)" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  {ocrResult ? "読取完了。下のフォームを確認してください" : "読み取れませんでした"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOcrPreview(null);
                    setOcrResult(null);
                  }}
                  className="text-xs px-2 py-1 rounded transition"
                  style={{
                    background: "var(--bg-overlay)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  画像を消す
                </button>
              </div>
            </div>
          )}
        </div>

        <form key={formKey} action={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              取引の種類
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setCategory(opt.value); setType(getDefaultType(opt.value)); }}
                  className="text-left p-3 rounded-lg text-xs transition"
                  style={{
                    background: category === opt.value ? "var(--bg-hover)" : "var(--bg-overlay)",
                    border: category === opt.value
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border-default)",
                  }}
                >
                  <div className="font-semibold text-sm text-[var(--text-primary)]">{opt.label}</div>
                  <div className="text-[var(--text-tertiary)] mt-0.5 text-[11px]">{opt.description}</div>
                </button>
              ))}
            </div>
            <input type="hidden" name="category" value={category} />
          </div>

          {category === "business" && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                収入 / 支出
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background: type === "expense" ? "var(--text-primary)" : "var(--bg-overlay)",
                    color: type === "expense" ? "var(--bg-base)" : "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background: type === "income" ? "#34d399" : "var(--bg-overlay)",
                    color: type === "income" ? "var(--bg-base)" : "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  収入
                </button>
              </div>
            </div>
          )}
          <input type="hidden" name="type" value={getDefaultType(category)} />

          {isTaxDeductible && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                控除の種類
              </label>
              <select
                name="taxDeductionType"
                required
                className="w-full px-3 py-2.5 text-sm rounded-lg"
                defaultValue=""
              >
                <option value="" disabled>選択してください</option>
                {TAX_DEDUCTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {isReimbursable && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                立替の動き
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background: type === "expense" ? "var(--text-primary)" : "var(--bg-overlay)",
                    color: type === "expense" ? "var(--bg-base)" : "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  立替(支払った)
                </button>
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition"
                  style={{
                    background: type === "income" ? "#34d399" : "var(--bg-overlay)",
                    color: type === "income" ? "var(--bg-base)" : "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  回収(受け取った)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                日付
              </label>
              <input
                type="date"
                name="date"
                defaultValue={ocrResult?.date || today}
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
                placeholder="0"
                min="1"
                step="1"
                defaultValue={ocrResult?.amount || ""}
                required
                className="w-full px-3 py-2.5 text-sm tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              内容
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
              defaultValue={ocrResult?.description || ""}
              required
              className="w-full px-3 py-2.5 text-sm"
            />
          </div>

          {/* 勘定科目 */}
          {(category === "business" || isReimbursable || isFixedAsset) && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                勘定科目
              </label>
              <select
                name="accountCode"
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
                  : EXPENSE_ACCOUNTS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt.code} value={opt.code}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
              </select>
            </div>
          )}

          {showTags && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                事業タグ(複数選択可)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((tag) => {
                  const selected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition"
                      style={{
                        background: selected
                          ? `${tag.color}20`
                          : "var(--bg-overlay)",
                        color: selected ? tag.color : "var(--text-secondary)",
                        border: selected
                          ? `1px solid ${tag.color}`
                          : "1px solid var(--border-default)",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(category === "business" || isReimbursable) && (
            <>
              <div>
                <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                  決済状態
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlementStatus("settled")}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium transition"
                    style={{
                      background: settlementStatus === "settled" ? "var(--bg-hover)" : "var(--bg-overlay)",
                      color: settlementStatus === "settled" ? "var(--text-primary)" : "var(--text-secondary)",
                      border: settlementStatus === "settled"
                        ? "1px solid var(--border-strong)"
                        : "1px solid var(--border-default)",
                    }}
                  >
                    {type === "income" ? "入金済み" : "支払済み"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementStatus("unpaid")}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium transition"
                    style={{
                      background: settlementStatus === "unpaid" ? "rgba(248, 113, 113, 0.15)" : "var(--bg-overlay)",
                      color: settlementStatus === "unpaid" ? "#f87171" : "var(--text-secondary)",
                      border: settlementStatus === "unpaid"
                        ? "1px solid #f87171"
                        : "1px solid var(--border-default)",
                    }}
                  >
                    {type === "income" ? "未入金" : "未払い"}
                  </button>
                </div>
                <input type="hidden" name="settlementStatus" value={settlementStatus} />
              </div>

              {settlementStatus === "unpaid" && (
                <div>
                  <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                    {type === "income" ? "入金予定日" : "支払予定日"}
                  </label>
                  <input type="date" name="expectedSettlementDate" className="w-full px-3 py-2.5 text-sm" />
                </div>
              )}
            </>
          )}

          {(category === "business" || isReimbursable || isPrivate || isTaxDeductible || isFixedAsset) && (
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                決済方法
              </label>
              <select name="paymentMethod" defaultValue="" className="w-full px-3 py-2.5 text-sm">
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
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              メモ(任意)
            </label>
            <textarea
              name="note"
              rows={2}
              placeholder="税務調査時の説明用に詳細を書いておくと安心"
              className="w-full px-3 py-2.5 text-sm resize-none"
            />
          </div>

          {error && (
            <div
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: "var(--color-danger-bg)",
                color: "#f87171",
                border: "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              {error}
            </div>
          )}

          <div
            className="flex justify-end gap-2 pt-3"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <button
              type="button"
              onClick={() => { resetForm(); setOpen(false); }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{
                background: "var(--bg-overlay)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
              disabled={isPending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "white" }}
            >
              {isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
