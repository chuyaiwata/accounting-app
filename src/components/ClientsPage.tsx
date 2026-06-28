"use client";

import { useState, useTransition } from "react";
import type { Counterparty, CounterpartyType } from "@/lib/types";
import { addCounterparty, updateCounterparty, deleteCounterparty } from "@/lib/actions/clients";
import { Plus, Trash2, Pencil, X, Loader2, Save, Users } from "lucide-react";

interface Props {
  initialCounterparties: Counterparty[];
}

const TYPE_OPTIONS: { value: CounterpartyType; label: string }[] = [
  { value: "individual", label: "個人" },
  { value: "tax_exempt", label: "免税事業者" },
  { value: "taxable_with_t", label: "課税事業者(T番号あり)" },
  { value: "taxable_no_t", label: "課税事業者(T番号なし)" },
];

export default function ClientsPage({ initialCounterparties }: Props) {
  const [items, setItems] = useState<Counterparty[]>(initialCounterparties);
  const [editing, setEditing] = useState<Counterparty | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const reload = async () => {
    const { listCounterparties } = await import("@/lib/actions/clients");
    const fresh = await listCounterparties();
    setItems(fresh);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-6 md:mb-8 flex-wrap gap-3">
        <div>
          <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mb-1 md:mb-2 tracking-wide uppercase">
            取引先マスタ
          </p>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight leading-none">
            取引先一覧
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus className="w-4 h-4" />
          新規取引先
        </button>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
        >
          <Users className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">取引先がまだ登録されていません</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">「新規取引先」ボタンから登録してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((cp) => (
            <div
              key={cp.id}
              className="rounded-xl p-4 flex items-start justify-between gap-3"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-sm md:text-base font-semibold truncate">{cp.name}</h3>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-medium"
                    style={{ background: "var(--bg-overlay)", color: "var(--text-secondary)" }}
                  >
                    {TYPE_OPTIONS.find((o) => o.value === cp.type)?.label || cp.type}
                  </span>
                  {cp.withholdingDefault && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-medium"
                      style={{ background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24" }}
                    >
                      源泉徴収
                    </span>
                  )}
                </div>
                {cp.email && (
                  <p className="text-xs text-[var(--text-tertiary)] truncate">{cp.email}</p>
                )}
                {cp.tNumber && (
                  <p className="text-xs text-[var(--text-tertiary)] tabular">T{cp.tNumber}</p>
                )}
                {cp.note && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 truncate">{cp.note}</p>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditing(cp)}
                  className="p-2 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
                  title="編集"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("削除しますか?")) return;
                    await deleteCounterparty(cp.id);
                    await reload();
                  }}
                  className="p-2 rounded text-[var(--text-tertiary)] hover:text-[#f87171] transition"
                  title="削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editing) && (
        <CounterpartyModal
          editing={editing}
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
    </div>
  );
}

function CounterpartyModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Counterparty | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState<CounterpartyType>(editing?.type || "individual");
  const [email, setEmail] = useState(editing?.email || "");
  const [address, setAddress] = useState(editing?.address || "");
  const [tNumber, setTNumber] = useState(editing?.tNumber || "");
  const [withholdingDefault, setWithholdingDefault] = useState(editing?.withholdingDefault || false);
  const [note, setNote] = useState(editing?.note || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if (!name) {
      setError("取引先名は必須です");
      return;
    }
    startTransition(async () => {
      const input = {
        name,
        type,
        email: email || undefined,
        address: address || undefined,
        tNumber: tNumber || undefined,
        withholdingDefault,
        note: note || undefined,
      };
      const res = editing
        ? await updateCounterparty(editing.id, input)
        : await addCounterparty(input);
      if (res.ok) {
        await onSaved();
      } else {
        setError(res.error || "保存失敗");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-0 md:p-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-xl rounded-none md:rounded-2xl my-0 md:my-8"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div>
            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase">取引先</p>
            <h2 className="text-lg font-semibold">{editing ? "編集" : "新規登録"}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 pb-24 md:pb-5">
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
              取引先名 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              placeholder="株式会社XYZ"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
              区分
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CounterpartyType)}
              className="w-full px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
              T番号(任意)
            </label>
            <input
              type="text"
              value={tNumber}
              onChange={(e) => setTNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm tabular"
              placeholder="1234567890123"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
              メール(任意)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
              住所(任意)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="withholding"
              checked={withholdingDefault}
              onChange={(e) => setWithholdingDefault(e.target.checked)}
            />
            <label htmlFor="withholding" className="text-sm text-[var(--text-secondary)]">
              源泉徴収対象(デフォルト)
            </label>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5 font-medium">
              メモ(任意)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              rows={2}
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
