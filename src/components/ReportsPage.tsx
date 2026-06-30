"use client";

import { useState } from "react";
import type { PLData, BSData, TrialBalance } from "@/lib/actions/journalReports";

type Tab = "pl" | "bs" | "tb";

export function ReportsPage({
  initialPL,
  initialBS,
  initialTB,
}: {
  initialPL: PLData;
  initialBS: BSData;
  initialTB: TrialBalance;
}) {
  const [tab, setTab] = useState<Tab>("pl");

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-4">
        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">決算書</p>
        <h1 className="text-2xl md:text-3xl font-semibold mt-1">{initialPL.fiscalYear}年度</h1>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-5 rounded-lg p-1" style={{ background: "var(--bg-elevated)" }}>
        <TabButton active={tab === "pl"} onClick={() => setTab("pl")}>損益計算書(P/L)</TabButton>
        <TabButton active={tab === "bs"} onClick={() => setTab("bs")}>貸借対照表(B/S)</TabButton>
        <TabButton active={tab === "tb"} onClick={() => setTab("tb")}>試算表</TabButton>
      </div>

      {tab === "pl" && <PLView pl={initialPL} />}
      {tab === "bs" && <BSView bs={initialBS} />}
      {tab === "tb" && <TBView tb={initialTB} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-3 py-2 rounded-md text-xs md:text-sm font-medium transition"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "white" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function PLView({ pl }: { pl: PLData }) {
  return (
    <div className="rounded-2xl p-4 md:p-6 space-y-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
      {/* 収益 */}
      <Section title="収益">
        {pl.revenue.length === 0 ? <Empty /> : pl.revenue.map((r) => <Row key={r.account} label={r.name} amount={r.amount} />)}
        <RowTotal label="売上合計" amount={pl.totalRevenue} />
      </Section>

      {/* 費用 */}
      <Section title="費用">
        {pl.expenses.length === 0 ? <Empty /> : pl.expenses.map((r) => <Row key={r.account} label={r.name} amount={r.amount} />)}
        <RowTotal label="費用合計" amount={pl.totalExpense} />
      </Section>

      {/* 当期純利益 */}
      <div className="rounded-lg p-4 mt-4" style={{ background: pl.netIncome >= 0 ? "rgba(52, 211, 153, 0.1)" : "rgba(248, 113, 113, 0.1)" }}>
        <div className="flex items-center justify-between">
          <span className="text-sm md:text-base font-semibold">当期純利益</span>
          <span className="text-xl md:text-2xl font-bold tabular" style={{ color: pl.netIncome >= 0 ? "#34d399" : "#f87171" }}>
            {pl.netIncome >= 0 ? "+" : ""}¥{pl.netIncome.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function BSView({ bs }: { bs: BSData }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* 資産 */}
      <div className="rounded-2xl p-4 md:p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <h3 className="text-sm font-semibold mb-3">資産</h3>
        {bs.assets.length === 0 ? <Empty /> : bs.assets.map((r) => <Row key={r.account} label={r.name} amount={r.amount} />)}
        <RowTotal label="資産合計" amount={bs.totalAssets} />
      </div>

      {/* 負債・純資産 */}
      <div className="rounded-2xl p-4 md:p-6 space-y-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <div>
          <h3 className="text-sm font-semibold mb-3">負債</h3>
          {bs.liabilities.length === 0 ? <Empty /> : bs.liabilities.map((r) => <Row key={r.account} label={r.name} amount={r.amount} />)}
          <RowTotal label="負債合計" amount={bs.totalLiabilities} />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-3">純資産</h3>
          {bs.equity.length === 0 ? <Empty /> : bs.equity.map((r) => <Row key={r.account} label={r.name} amount={r.amount} />)}
          <Row label="当期純利益" amount={bs.netIncome} />
          <RowTotal label="純資産合計" amount={bs.totalEquity + bs.netIncome} />
        </div>
        <RowTotal label="負債・純資産合計" amount={bs.totalLiabilities + bs.totalEquity + bs.netIncome} />
      </div>
    </div>
  );
}

function TBView({ tb }: { tb: TrialBalance }) {
  return (
    <div className="rounded-2xl p-4 md:p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-default)" }}>
              <th className="text-left py-2 px-1 font-medium text-[var(--text-tertiary)]">勘定科目</th>
              <th className="text-right py-2 px-1 font-medium text-[var(--text-tertiary)]">借方合計</th>
              <th className="text-right py-2 px-1 font-medium text-[var(--text-tertiary)]">貸方合計</th>
              <th className="text-right py-2 px-1 font-medium text-[var(--text-tertiary)]">残高</th>
            </tr>
          </thead>
          <tbody>
            {tb.rows.map((r) => (
              <tr key={r.accountCode} className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <td className="py-2 px-1">{r.accountName}</td>
                <td className="py-2 px-1 text-right tabular">{r.debit > 0 ? "¥" + r.debit.toLocaleString() : "-"}</td>
                <td className="py-2 px-1 text-right tabular">{r.credit > 0 ? "¥" + r.credit.toLocaleString() : "-"}</td>
                <td className="py-2 px-1 text-right tabular font-medium">{r.balance !== 0 ? "¥" + r.balance.toLocaleString() : "-"}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--border-default)" }}>
              <td className="py-2 px-1 font-semibold">合計</td>
              <td className="py-2 px-1 text-right tabular font-semibold">¥{tb.totalDebit.toLocaleString()}</td>
              <td className="py-2 px-1 text-right tabular font-semibold">¥{tb.totalCredit.toLocaleString()}</td>
              <td className="py-2 px-1 text-right tabular">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-[var(--text-secondary)]">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="tabular">¥{amount.toLocaleString()}</span>
    </div>
  );
}

function RowTotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-2 mt-2 text-sm font-semibold" style={{ borderTop: "1px solid var(--border-default)" }}>
      <span>{label}</span>
      <span className="tabular">¥{amount.toLocaleString()}</span>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-[var(--text-tertiary)] py-2">データなし</p>;
}
