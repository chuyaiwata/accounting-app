"use client";

import { useState, useMemo } from "react";
import { Transaction } from "@/lib/types";
import { EXPENSE_ACCOUNTS, INCOME_ACCOUNTS, ALL_ACCOUNT_LABELS } from "@/lib/data/accountOptions";
import { Search, X, Filter } from "lucide-react";

export interface TransactionFilterState {
  month: string;
  accountCodes: string[];
  tagIds: string[];
  minAmount: string;
  maxAmount: string;
  keyword: string;
}

const TAG_META: Record<string, { name: string; color: string }> = {
  pbs4: { name: "PBS4", color: "#4f8bff" },
  upcycle: { name: "アップサイクル", color: "#34d399" },
  event: { name: "イベント", color: "#fbbf24" },
  common: { name: "共通", color: "#7a7f8c" },
};

interface Props {
  filters: TransactionFilterState;
  onChange: (filters: TransactionFilterState) => void;
  transactions: Transaction[];
}

export default function TransactionFilters({ filters, onChange, transactions }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // データに含まれる月の一覧
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  // データに含まれる勘定科目コード
  const usedAccountCodes = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.accountCode && set.add(t.accountCode));
    return set;
  }, [transactions]);

  const toggleAccountCode = (code: string) => {
    if (filters.accountCodes.includes(code)) {
      onChange({ ...filters, accountCodes: filters.accountCodes.filter((c) => c !== code) });
    } else {
      onChange({ ...filters, accountCodes: [...filters.accountCodes, code] });
    }
  };

  const toggleTag = (tagId: string) => {
    if (filters.tagIds.includes(tagId)) {
      onChange({ ...filters, tagIds: filters.tagIds.filter((t) => t !== tagId) });
    } else {
      onChange({ ...filters, tagIds: [...filters.tagIds, tagId] });
    }
  };

  const clearAll = () => {
    onChange({
      month: "all",
      accountCodes: [],
      tagIds: [],
      minAmount: "",
      maxAmount: "",
      keyword: "",
    });
  };

  const hasActiveFilters =
    filters.month !== "all" ||
    filters.accountCodes.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.minAmount !== "" ||
    filters.maxAmount !== "" ||
    filters.keyword !== "";

  return (
    <div
      className="rounded-xl mb-6 overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* 上段: 月セレクト + キーワード検索 + 詳細トグル */}
      <div className="p-3 md:p-4 flex flex-col md:flex-row gap-2 md:gap-3">
        <select
          value={filters.month}
          onChange={(e) => onChange({ ...filters, month: e.target.value })}
          className="px-3 py-2 text-sm md:w-40"
        >
          <option value="all">全期間</option>
          {availableMonths.map((m) => {
            const [y, mo] = m.split("-");
            return (
              <option key={m} value={m}>
                {y}年{Number(mo)}月
              </option>
            );
          })}
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="店名・内容で検索..."
            value={filters.keyword}
            onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
            className="w-full pl-9 pr-3 py-2 text-sm"
          />
        </div>

        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 justify-center"
          style={{
            background: advancedOpen ? "var(--accent-muted)" : "var(--bg-overlay)",
            color: advancedOpen ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          <Filter className="w-4 h-4" />
          詳細フィルタ
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1 justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
          >
            <X className="w-4 h-4" />
            クリア
          </button>
        )}
      </div>

      {/* 下段: 詳細フィルタ */}
      {advancedOpen && (
        <div
          className="px-3 md:px-4 pb-3 md:pb-4 pt-1 md:pt-2 space-y-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {/* 事業タグ */}
          <div>
            <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-2 mt-3 font-medium">
              事業タグ
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TAG_META).map(([tagId, meta]) => {
                const active = filters.tagIds.includes(tagId);
                return (
                  <button
                    key={tagId}
                    onClick={() => toggleTag(tagId)}
                    className="text-xs px-2.5 py-1 rounded-md font-medium transition"
                    style={{
                      background: active ? `${meta.color}25` : "var(--bg-overlay)",
                      color: active ? meta.color : "var(--text-secondary)",
                      border: `1px solid ${active ? meta.color : "transparent"}`,
                    }}
                  >
                    {meta.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 勘定科目 */}
          <div>
            <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              勘定科目
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...EXPENSE_ACCOUNTS.flatMap((g) => g.options), ...INCOME_ACCOUNTS]
                .filter((opt) => usedAccountCodes.has(opt.code))
                .map((opt) => {
                  const active = filters.accountCodes.includes(opt.code);
                  return (
                    <button
                      key={opt.code}
                      onClick={() => toggleAccountCode(opt.code)}
                      className="text-xs px-2.5 py-1 rounded-md font-medium transition"
                      style={{
                        background: active ? "var(--accent-muted)" : "var(--bg-overlay)",
                        color: active ? "var(--accent)" : "var(--text-secondary)",
                        border: `1px solid ${active ? "var(--accent)" : "transparent"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              {[...usedAccountCodes].length === 0 && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  まだ勘定科目が登録された取引がありません
                </p>
              )}
            </div>
          </div>

          {/* 金額範囲 */}
          <div>
            <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              金額範囲
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="最小"
                value={filters.minAmount}
                onChange={(e) => onChange({ ...filters, minAmount: e.target.value })}
                className="px-3 py-2 text-sm w-32"
              />
              <span className="text-[var(--text-tertiary)] text-sm">〜</span>
              <input
                type="number"
                placeholder="最大"
                value={filters.maxAmount}
                onChange={(e) => onChange({ ...filters, maxAmount: e.target.value })}
                className="px-3 py-2 text-sm w-32"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
