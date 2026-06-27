"use client";

import { useState, useMemo } from "react";
import { Transaction } from "@/lib/types";
import { ALL_ACCOUNT_LABELS } from "@/lib/data/accountOptions";
import TransactionFilters, { TransactionFilterState } from "./TransactionFilters";
import { Receipt, Trash2, Pencil } from "lucide-react";
import { deleteTransaction } from "@/lib/actions/transactions";
import EditTransactionModal from "./EditTransactionModal";
import ImportCsvModal from "./ImportCsvModal";
import { Upload } from "lucide-react";

const TAG_META: Record<string, { name: string; color: string }> = {
  pbs4: { name: "PBS4", color: "#4f8bff" },
  upcycle: { name: "アップサイクル", color: "#34d399" },
  event: { name: "イベント", color: "#fbbf24" },
  common: { name: "共通", color: "#7a7f8c" },
};

interface Props {
  transactions: Transaction[];
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function TransactionsPage({ transactions }: Props) {
  const [filters, setFilters] = useState<TransactionFilterState>({
    month: getCurrentMonth(),
    accountCodes: [],
    tagIds: [],
    minAmount: "",
    maxAmount: "",
    keyword: "",
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // フィルタリング
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        // 月フィルタ
        if (filters.month && filters.month !== "all" && !t.date.startsWith(filters.month)) {
          return false;
        }
        // 勘定科目フィルタ
        if (filters.accountCodes.length > 0) {
          if (!t.accountCode || !filters.accountCodes.includes(t.accountCode)) {
            return false;
          }
        }
        // タグフィルタ
        if (filters.tagIds.length > 0) {
          const txTags = t.tagIds || [];
          if (!filters.tagIds.some((tag) => txTags.includes(tag))) {
            return false;
          }
        }
        // 金額範囲
        const min = filters.minAmount ? Number(filters.minAmount) : null;
        const max = filters.maxAmount ? Number(filters.maxAmount) : null;
        if (min !== null && t.amount < min) return false;
        if (max !== null && t.amount > max) return false;
        // キーワード
        if (filters.keyword) {
          const kw = filters.keyword.toLowerCase();
          const hit =
            t.description.toLowerCase().includes(kw) ||
            (t.note || "").toLowerCase().includes(kw);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filters]);

  // 集計
  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="px-4 md:px-10 py-6 md:py-8 max-w-[1400px]">
      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-6 md:mb-8 flex-wrap gap-3">
        <div>
          <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mb-1 md:mb-2 tracking-wide uppercase">
            取引管理
          </p>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight leading-none">
            取引一覧
          </h1>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        >
          <Upload className="w-4 h-4" />
          CSV取込
        </button>
      </div>

      {/* フィルタ */}
      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        transactions={transactions}
      />

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-6">
        <div
          className="rounded-xl p-3 md:p-4"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mb-1">件数</p>
          <p className="tabular text-base md:text-xl font-semibold">
            {filteredTransactions.length}
            <span className="text-xs text-[var(--text-tertiary)] ml-1">件</span>
          </p>
        </div>
        <div
          className="rounded-xl p-3 md:p-4"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mb-1">収入</p>
          <p className="tabular text-base md:text-xl font-semibold" style={{ color: "#34d399" }}>
            +¥{totalIncome.toLocaleString()}
          </p>
        </div>
        <div
          className="rounded-xl p-3 md:p-4"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mb-1">支出</p>
          <p className="tabular text-base md:text-xl font-semibold" style={{ color: "#f87171" }}>
            -¥{totalExpense.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 取引一覧 */}
      {filteredTransactions.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Receipt className="w-8 h-8 mx-auto mb-3 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            該当する取引がありません
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            フィルタを変更してください
          </p>
        </div>
      ) : (
        <>
          {/* PC: テーブル */}
          <div
            className="hidden md:block rounded-xl overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <table className="w-full text-sm">
              <thead style={{ background: "var(--bg-overlay)" }}>
                <tr className="text-left text-[var(--text-tertiary)]">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">日付</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">内容</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">勘定科目</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">タグ</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-right">金額</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-right w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => (
                  <TransactionRow key={t.id} transaction={t} onEdit={() => setEditingTransaction(t)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* モバイル: カード */}
          <div className="md:hidden space-y-2">
            {filteredTransactions.map((t) => (
              <TransactionCard key={t.id} transaction={t} onEdit={() => setEditingTransaction(t)} />
            ))}
          </div>
        </>
      )}

      {/* 編集モーダル */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {/* CSV取込モーダル */}
      {importOpen && <ImportCsvModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function TransactionRow({ transaction, onEdit }: { transaction: Transaction; onEdit: () => void }) {
  const isIncome = transaction.type === "income";
  const accountLabel = transaction.accountCode
    ? ALL_ACCOUNT_LABELS[transaction.accountCode]
    : null;

  const handleDelete = async () => {
    if (!confirm("この取引を削除しますか?")) return;
    await deleteTransaction(transaction.id);
  };

  return (
    <tr
      className="border-t hover:bg-[var(--bg-hover)] transition"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
        {transaction.date}
      </td>
      <td className="px-4 py-3">
        <p className="text-[var(--text-primary)] font-medium">{transaction.description}</p>
        {transaction.note && (
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{transaction.note}</p>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
        {accountLabel || "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {(transaction.tagIds || []).map((tagId) => {
            const meta = TAG_META[tagId];
            if (!meta) return null;
            return (
              <span
                key={tagId}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: `${meta.color}20`, color: meta.color }}
              >
                {meta.name}
              </span>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular font-medium" style={{ color: isIncome ? "#34d399" : "#f87171" }}>
        {isIncome ? "+" : "-"}¥{transaction.amount.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex gap-1 justify-end">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-[var(--bg-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
            title="編集"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-[var(--bg-overlay)] text-[var(--text-tertiary)] hover:text-[#f87171] transition"
            title="削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TransactionCard({ transaction, onEdit }: { transaction: Transaction; onEdit: () => void }) {
  const isIncome = transaction.type === "income";
  const accountLabel = transaction.accountCode
    ? ALL_ACCOUNT_LABELS[transaction.accountCode]
    : null;

  const handleDelete = async () => {
    if (!confirm("この取引を削除しますか?")) return;
    await deleteTransaction(transaction.id);
  };

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {transaction.description}
          </p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
            {transaction.date}
            {accountLabel && ` · ${accountLabel}`}
          </p>
        </div>
        <p
          className="tabular text-sm font-semibold whitespace-nowrap"
          style={{ color: isIncome ? "#34d399" : "#f87171" }}
        >
          {isIncome ? "+" : "-"}¥{transaction.amount.toLocaleString()}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 flex-wrap">
          {(transaction.tagIds || []).map((tagId) => {
            const meta = TAG_META[tagId];
            if (!meta) return null;
            return (
              <span
                key={tagId}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: `${meta.color}20`, color: meta.color }}
              >
                {meta.name}
              </span>
            );
          })}
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition"
            title="編集"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[#f87171] transition"
            title="削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
