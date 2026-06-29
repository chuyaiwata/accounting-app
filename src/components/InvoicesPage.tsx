"use client";

import { useState, useTransition, useMemo } from "react";
import type { Invoice, InvoiceItem, InvoiceItemDetail, Counterparty, AppSettings, InvoiceStatus } from "@/lib/types";
import { addInvoice, updateInvoice, deleteInvoice, markInvoicePaid } from "@/lib/actions/invoices";
import { generateInvoicePdf, getInvoicePdf } from "@/lib/actions/generateInvoicePdf";
import { listInvoices } from "@/lib/actions/invoices";
import { Plus, Trash2, Pencil, X, Loader2, Save, FileText, Check, FileDown } from "lucide-react";

interface Props {
  initialInvoices: Invoice[];
  counterparties: Counterparty[];
  settings: AppSettings;
}

const STATUS_LABELS: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "下書き", color: "var(--text-tertiary)", bg: "var(--bg-overlay)" },
  sent: { label: "発行済", color: "#4f8bff", bg: "rgba(79, 139, 255, 0.15)" },
  paid: { label: "入金済", color: "#34d399", bg: "rgba(52, 211, 153, 0.15)" },
  overdue: { label: "期限超過", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)" },
  cancelled: { label: "キャンセル", color: "#f87171", bg: "rgba(248, 113, 113, 0.15)" },
};

export default function InvoicesPage({ initialInvoices, counterparties, settings }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const cpMap = useMemo(() => {
    const m = new Map<string, Counterparty>();
    counterparties.forEach((cp) => m.set(cp.id, cp));
    return m;
  }, [counterparties]);

  const reload = async () => {
    const fresh = await listInvoices();
    setInvoices(fresh);
  };

  const handleGeneratePdf = async (inv: Invoice) => {
    setPdfLoading(inv.id);
    try {
      const res = await generateInvoicePdf(inv.id);
      if (res.ok && res.fileId) {
        await reload();
        // 生成成功後、PDFを表示
        const view = await getInvoicePdf(res.fileId);
        if (view.ok && view.dataUrl) {
          setPdfDataUrl(view.dataUrl);
        }
      } else {
        alert(res.error || "PDF生成失敗");
      }
    } finally {
      setPdfLoading(null);
    }
  };

  const handleViewPdf = async (inv: Invoice) => {
    if (!inv.pdfDriveFileId) return;
    setPdfLoading(inv.id);
    try {
      const view = await getInvoicePdf(inv.pdfDriveFileId);
      if (view.ok && view.dataUrl) {
        setPdfDataUrl(view.dataUrl);
      } else {
        alert(view.error || "PDF取得失敗");
      }
    } finally {
      setPdfLoading(null);
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    const today = new Date().toISOString().slice(0, 10);
    const paymentDate = prompt("入金日 (YYYY-MM-DD)", today);
    if (!paymentDate) return;
    const res = await markInvoicePaid(inv.id, paymentDate);
    if (res.ok) {
      await reload();
    } else {
      alert(res.error || "処理失敗");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-6 md:mb-8 flex-wrap gap-3">
        <div>
          <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mb-1 md:mb-2 tracking-wide uppercase">
            請求書管理
          </p>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight leading-none">
            請求書一覧
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus className="w-4 h-4" />
          新規請求書
        </button>
      </div>

      {invoices.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
        >
          <FileText className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">請求書がまだありません</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">「新規請求書」ボタンから作成してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const cp = cpMap.get(inv.counterpartyId);
            const statusInfo = STATUS_LABELS[inv.status];
            return (
              <div
                key={inv.id}
                className="rounded-xl p-4 flex items-start justify-between gap-3"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm md:text-base font-semibold tabular">{inv.invoiceNo}</h3>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-medium"
                      style={{ background: statusInfo.bg, color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] truncate">
                    {cp?.name || "(取引先削除済)"}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-tertiary)]">
                    <span className="tabular">発行: {inv.issueDate}</span>
                    <span className="tabular">支払期限: {inv.dueDate}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-base md:text-lg font-semibold tabular text-[#34d399]">
                      +¥{inv.transferAmount.toLocaleString()}
                    </p>
                    {inv.withholdingAmount > 0 && (
                      <p className="text-[10px] text-[var(--text-tertiary)] tabular">
                        (税込¥{inv.total.toLocaleString()} - 源泉¥{inv.withholdingAmount.toLocaleString()})
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {inv.status === "sent" || inv.status === "overdue" && (
                      <button
                        onClick={() => handleMarkPaid(inv)}
                        className="p-2 rounded text-[var(--text-tertiary)] hover:text-[#34d399] transition"
                        title="入金確認"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {inv.pdfDriveFileId ? (
                      <button
                        onClick={() => handleViewPdf(inv)}
                        disabled={pdfLoading === inv.id}
                        className="p-2 rounded text-[var(--text-tertiary)] hover:text-[#4f8bff] transition disabled:opacity-50"
                        title="PDF表示"
                      >
                        {pdfLoading === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGeneratePdf(inv)}
                        disabled={pdfLoading === inv.id}
                        className="p-2 rounded text-[var(--text-tertiary)] hover:text-[#4f8bff] transition disabled:opacity-50"
                        title="PDF生成"
                      >
                        {pdfLoading === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => setEditing(inv)}
                      className="p-2 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
                      title="編集"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("削除しますか?")) return;
                        await deleteInvoice(inv.id);
                        await reload();
                      }}
                      className="p-2 rounded text-[var(--text-tertiary)] hover:text-[#f87171] transition"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showCreate || editing) && (
        <InvoiceModal
          editing={editing}
          counterparties={counterparties}
          settings={settings}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await reload();
            setShowCreate(false);
            setEditing(null);
          }}
        />
      )}

      {pdfDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setPdfDataUrl(null)}
        >
          <div
            className="w-full h-full md:max-w-4xl md:max-h-[90vh] rounded-none md:rounded-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h2 className="text-sm font-semibold">請求書プレビュー</h2>
              <button onClick={() => setPdfDataUrl(null)} className="p-1.5 rounded hover:bg-[var(--bg-hover)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe src={pdfDataUrl} className="flex-1 w-full" title="Invoice PDF" />
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeOnBlur(value: string): string {
  // 全角数字 → 半角に変換
  value = value.replace(/[\uFF10-\uFF19]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  // 全角コロン → 半角に変換
  value = value.replace(/[\uFF1A]/g, ":");
  // 既に HH:MM 形式ならそのまま
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  // 数字のみを抽出
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 4) {
    const h = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    if (parseInt(h) < 24 && parseInt(m) < 60) {
      return h + ":" + m;
    }
  }
  if (digits.length === 3) {
    const h = digits.slice(0, 1);
    const m = digits.slice(1, 3);
    if (parseInt(m) < 60) {
      return "0" + h + ":" + m;
    }
  }
  return value;
}

function calcHoursFromTimes(startTime?: string, endTime?: string): number | null {
  if (!startTime || !endTime) return null;
  const parse = (t: string): number | null => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = parseInt(m[1]);
    const min = parseInt(m[2]);
    if (isNaN(h) || isNaN(min)) return null;
    return h * 60 + min;
  };
  const s = parse(startTime);
  const e = parse(endTime);
  if (s === null || e === null) return null;
  const diffMin = e - s;
  if (diffMin <= 0) return null;
  // 30分単位に丸める(0.5刻み)
  const hours = Math.round((diffMin / 60) * 2) / 2;
  return hours;
}

function generateDetailId() {
  return "d-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

function generateItemId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

function InvoiceModal({
  editing,
  counterparties,
  settings,
  onClose,
  onSaved,
}: {
  editing: Invoice | null;
  counterparties: Counterparty[];
  settings: AppSettings;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const next30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [counterpartyId, setCounterpartyId] = useState(
    editing?.counterpartyId || counterparties[0]?.id || ""
  );
  const [issueDate, setIssueDate] = useState(editing?.issueDate || today);
  const [dueDate, setDueDate] = useState(editing?.dueDate || next30);
  const [items, setItems] = useState<InvoiceItem[]>(
    editing?.items || [
      {
        id: generateItemId(),
        invoiceId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
        unit: "piece",
        details: [],
      },
    ]
  );
  const [withholdingTaxRate, setWithholdingTaxRate] = useState<number>(
    editing
      ? editing.total > 0
        ? Math.round((editing.withholdingAmount / editing.total) * 10000) / 100
        : 0
      : counterparties.find((c) => c.id === counterpartyId)?.withholdingDefault
        ? 10.21
        : 0
  );
  const [note, setNote] = useState(editing?.note || "");
  const [includeDetailSheet, setIncludeDetailSheet] = useState<boolean>(editing?.includeDetailSheet || false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 各itemの合計を計算するヘルパー(明細書ONの場合、detailsから集計)
  function calcItemSubtotal(item: InvoiceItem): number {
    if (includeDetailSheet && item.details && item.details.length > 0) {
      // 明細書ON: 各detailの単価x数量を合計
      return item.details.reduce((sum, d) => {
        const q = d.quantity ?? 0;
        const u = d.unitPrice ?? 0;
        return sum + q * u;
      }, 0);
    }
    // 明細書OFF or details空: itemの単価x数量
    return item.quantity * item.unitPrice;
  }

  // 自動計算
  const calc = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    for (const item of items) {
      const itemSubtotal = calcItemSubtotal(item);
      subtotal += itemSubtotal;
      taxAmount += Math.floor(itemSubtotal * item.taxRate / 100);
    }
    const total = subtotal + taxAmount;
    const withholdingAmount = Math.floor(total * withholdingTaxRate / 100);
    const transferAmount = total - withholdingAmount;
    return { subtotal, taxAmount, total, withholdingAmount, transferAmount };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, withholdingTaxRate, includeDetailSheet]);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    setItems([...items, {
      id: generateItemId(),
      invoiceId: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      unit: "piece",
      details: [],
    }]);
  };

  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    setError(null);
    if (!counterpartyId) {
      setError("取引先を選択してください");
      return;
    }
    if (items.some((it) => !it.description)) {
      setError("明細の摘要を入力してください");
      return;
    }
    startTransition(async () => {
      const input = {
        counterpartyId,
        issueDate,
        dueDate,
        items,
        withholdingTaxRate,
        note: note || undefined,
        includeDetailSheet,
      };
      const res = editing
        ? await updateInvoice(editing.id, input)
        : await addInvoice(input);
      if (res.ok) {
        await onSaved();
      } else {
        setError(res.error || "保存失敗");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-3xl rounded-none md:rounded-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div>
            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase">請求書</p>
            <h2 className="text-lg font-semibold">
              {editing ? "編集 " + editing.invoiceNo : "新規作成"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 pb-24 md:pb-5 flex-1 overflow-y-auto">
          {/* 取引先 + 日付 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
                取引先 *
              </label>
              <select
                value={counterpartyId}
                onChange={(e) => {
                  setCounterpartyId(e.target.value);
                  const cp = counterparties.find((c) => c.id === e.target.value);
                  if (cp) {
                    setWithholdingTaxRate(cp.withholdingDefault ? 10.21 : 0);
                  }
                }}
                className="w-full px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
                発行日
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
                支払期限
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular"
              />
            </div>
          </div>

          {/* 明細書チェックボックス */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="includeDetailSheet"
              checked={includeDetailSheet}
              onChange={(e) => setIncludeDetailSheet(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="includeDetailSheet" className="text-sm text-[var(--text-secondary)] cursor-pointer">
              明細書(2ページ目)を作成する
            </label>
          </div>

          {/* 明細 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide font-medium">
                明細
              </label>
              <button
                onClick={addItem}
                className="text-xs px-2 py-1 rounded flex items-center gap-1 transition"
                style={{ background: "var(--bg-overlay)", color: "var(--text-secondary)" }}
              >
                <Plus className="w-3 h-3" /> 明細追加
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-lg p-3"
                  style={{ background: "var(--bg-overlay)" }}
                >
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="摘要"
                      className="px-2 py-1.5 text-sm col-span-12 md:col-span-5"
                    />
                    <div className="col-span-3 md:col-span-2">
                      <label className="block text-[9px] text-[var(--text-tertiary)] mb-0.5">数量</label>
                      <input
                        type="number"
                        value={item.quantity || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm tabular text-right"
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="block text-[9px] text-[var(--text-tertiary)] mb-0.5">単価</label>
                      <input
                        type="number"
                        value={item.unitPrice || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm tabular text-right"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <label className="block text-[9px] text-[var(--text-tertiary)] mb-0.5">税率%</label>
                      <select
                        value={item.taxRate}
                        onChange={(e) => updateItem(idx, { taxRate: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 text-sm tabular"
                      >
                        <option value={0}>免税</option>
                        <option value={8}>8%</option>
                        <option value={10}>10%</option>
                      </select>
                    </div>
                    <div className="col-span-2 md:col-span-1 flex items-end">
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[#f87171] transition disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-right text-xs text-[var(--text-tertiary)] tabular">
{(() => {
                      if (includeDetailSheet && item.details && item.details.length > 0) {
                        const totalQty = item.details.reduce((sum, d) => sum + (d.quantity || 0), 0);
                        const unitLabel = item.unit === "hour" ? "時間" : "個";
                        return "小計: " + totalQty + unitLabel + " / ¥" + calcItemSubtotal(item).toLocaleString();
                      }
                      return "小計: ¥" + calcItemSubtotal(item).toLocaleString();
                    })()}
                  </div>

                  {/* 単位選択 */}
                  <div className="mt-2 flex items-center gap-3">
                    <label className="text-[10px] text-[var(--text-tertiary)]">単位:</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => updateItem(idx, { unit: "hour" })}
                        className="px-2 py-1 rounded text-[10px] transition"
                        style={{
                          background: (item.unit || "piece") === "hour" ? "var(--accent)" : "var(--bg-elevated)",
                          color: (item.unit || "piece") === "hour" ? "white" : "var(--text-secondary)",
                        }}
                      >時間</button>
                      <button
                        type="button"
                        onClick={() => updateItem(idx, { unit: "piece" })}
                        className="px-2 py-1 rounded text-[10px] transition"
                        style={{
                          background: (item.unit || "piece") === "piece" ? "var(--accent)" : "var(--bg-elevated)",
                          color: (item.unit || "piece") === "piece" ? "white" : "var(--text-secondary)",
                        }}
                      >個数</button>
                    </div>
                  </div>

                  {/* 明細書 ON 時に表示される詳細リスト */}
                  {includeDetailSheet && (
                    <div className="mt-3 space-y-2 border-t pt-2" style={{ borderColor: "var(--border-subtle)" }}>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-[var(--text-tertiary)]">
                          明細書の詳細 ({(item.details || []).length}件)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const newDetail: InvoiceItemDetail = {
                              id: generateDetailId(),
                              date: "",
                              startTime: "",
                              endTime: "",
                              location: "",
                              unitPrice: item.unitPrice,
                              quantity: 1,
                              note: "",
                            };
                            updateItem(idx, { details: [...(item.details || []), newDetail] });
                          }}
                          className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1"
                          style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}
                        >
                          <Plus className="w-2.5 h-2.5" /> 行追加
                        </button>
                      </div>
                      {(item.details || []).map((d, dIdx) => {
                        const rowAmount = (d.quantity ?? 0) * (d.unitPrice ?? 0);
                        return (
                          <div key={d.id} className="rounded-md p-2 space-y-1.5" style={{ background: "var(--bg-elevated)" }}>
                            <div className="grid grid-cols-12 gap-1 items-center">
                              <input
                                type="text"
                                value={d.date || ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const newDetails = [...(item.details || [])];
                                  newDetails[dIdx] = { ...d, date: e.target.value };
                                  updateItem(idx, { details: newDetails });
                                }}
                                placeholder="5/5"
                                className="px-1 py-0.5 text-xs tabular col-span-2 md:col-span-2"
                              />
                              <input
                                type="text"
                                value={d.startTime || ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const newDetails = [...(item.details || [])];
                                  const updated = { ...d, startTime: e.target.value };
                                  newDetails[dIdx] = updated;
                                  updateItem(idx, { details: newDetails });
                                }}
                                onBlur={(e) => {
                                  const formatted = formatTimeOnBlur(e.target.value);
                                  const newDetails = [...(item.details || [])];
                                  const updated = { ...d, startTime: formatted };
                                  if (item.unit === "hour") {
                                    const hours = calcHoursFromTimes(updated.startTime, updated.endTime);
                                    if (hours !== null) updated.quantity = hours;
                                  }
                                  newDetails[dIdx] = updated;
                                  updateItem(idx, { details: newDetails });
                                }}
                                placeholder="09:00"
                                className="px-1 py-0.5 text-xs tabular col-span-2 md:col-span-1"
                              />
                              <input
                                type="text"
                                value={d.endTime || ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const newDetails = [...(item.details || [])];
                                  const updated = { ...d, endTime: e.target.value };
                                  newDetails[dIdx] = updated;
                                  updateItem(idx, { details: newDetails });
                                }}
                                onBlur={(e) => {
                                  const formatted = formatTimeOnBlur(e.target.value);
                                  const newDetails = [...(item.details || [])];
                                  const updated = { ...d, endTime: formatted };
                                  if (item.unit === "hour") {
                                    const hours = calcHoursFromTimes(updated.startTime, updated.endTime);
                                    if (hours !== null) updated.quantity = hours;
                                  }
                                  newDetails[dIdx] = updated;
                                  updateItem(idx, { details: newDetails });
                                }}
                                placeholder="11:00"
                                className="px-1 py-0.5 text-xs tabular col-span-2 md:col-span-1"
                              />
                              <input
                                type="text"
                                value={d.location || ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const newDetails = [...(item.details || [])];
                                  newDetails[dIdx] = { ...d, location: e.target.value };
                                  updateItem(idx, { details: newDetails });
                                }}
                                placeholder="場所"
                                className="px-1 py-0.5 text-xs col-span-6 md:col-span-7"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newDetails = (item.details || []).filter((_, i) => i !== dIdx);
                                  updateItem(idx, { details: newDetails });
                                }}
                                className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[#f87171] transition col-span-12 md:col-span-1 flex justify-end"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="grid grid-cols-12 gap-1 items-center">
                              <input
                                type="number"
                                value={d.unitPrice || ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const newDetails = [...(item.details || [])];
                                  newDetails[dIdx] = { ...d, unitPrice: Number(e.target.value) || 0 };
                                  updateItem(idx, { details: newDetails });
                                }}
                                placeholder="単価"
                                className="px-1 py-0.5 text-xs tabular text-right col-span-3 md:col-span-3"
                              />
                              <input
                                type="number"
                                value={d.quantity || ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const newDetails = [...(item.details || [])];
                                  newDetails[dIdx] = { ...d, quantity: Number(e.target.value) || 0 };
                                  updateItem(idx, { details: newDetails });
                                }}
                                placeholder={item.unit === "hour" ? "時間" : "数量"}
                                className="px-1 py-0.5 text-xs tabular text-right col-span-2 md:col-span-2"
                              />
                              <span className="text-xs text-[var(--text-tertiary)] text-right tabular col-span-3 md:col-span-3">
                                = ¥{rowAmount.toLocaleString()}
                              </span>
                              <input
                                type="text"
                                value={d.note || ""}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const newDetails = [...(item.details || [])];
                                  newDetails[dIdx] = { ...d, note: e.target.value };
                                  updateItem(idx, { details: newDetails });
                                }}
                                placeholder="備考"
                                className="px-1 py-0.5 text-xs col-span-4 md:col-span-4"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 源泉徴収 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
                源泉徴収率 (%)
              </label>
              <select
                value={withholdingTaxRate}
                onChange={(e) => setWithholdingTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm tabular"
              >
                <option value={0}>なし</option>
                <option value={10.21}>10.21% (報酬料金)</option>
                <option value={20.42}>20.42% (100万円超)</option>
              </select>
            </div>
          </div>

          {/* 合計欄 */}
          <div
            className="rounded-xl p-4 space-y-1"
            style={{ background: "var(--bg-overlay)" }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">小計</span>
              <span className="tabular">¥{calc.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">消費税</span>
              <span className="tabular">¥{calc.taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-medium border-t border-[var(--border-subtle)] pt-1 mt-1">
              <span className="text-[var(--text-secondary)]">税込合計</span>
              <span className="tabular">¥{calc.total.toLocaleString()}</span>
            </div>
            {calc.withholdingAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">源泉徴収</span>
                <span className="tabular text-[#f87171]">-¥{calc.withholdingAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold border-t border-[var(--border-subtle)] pt-2 mt-1">
              <span>振込金額</span>
              <span className="tabular text-[#34d399]">¥{calc.transferAmount.toLocaleString()}</span>
            </div>
          </div>

          {/* 振込先プレビュー */}
          {settings.bankAccount && (
            <div
              className="rounded-lg p-3 text-xs"
              style={{ background: "var(--bg-overlay)", color: "var(--text-secondary)" }}
            >
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">振込先(請求書に記載)</p>
              {settings.bankAccount.bankName} {settings.bankAccount.branchName} {settings.bankAccount.accountType === "ordinary" ? "普通" : "当座"} {settings.bankAccount.accountNumber} {settings.bankAccount.accountHolder}
            </div>
          )}

          {/* 備考 */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
              備考(任意)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              rows={2}
              placeholder="お支払い時の振込手数料はご負担ください 等"
            />
          </div>



          {error && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: "rgba(248, 113, 113, 0.1)", color: "#f87171" }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition"
              style={{ background: "var(--bg-overlay)", color: "var(--text-secondary)" }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "var(--accent)", color: "white" }}
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
