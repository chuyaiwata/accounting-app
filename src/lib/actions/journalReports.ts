"use server";

import type { Transaction, JournalEntry } from "@/lib/types";
import { bulkTransactionToJournal } from "./journalEngine";
import { JOURNAL_ACCOUNTS, getAccountByCode } from "@/lib/data/journalAccounts";
import { listTransactions } from "./transactions";
import { loadSettings } from "./settings";

// =============== 仕訳帳 ===============
export interface JournalRow {
  date: string;
  description: string;
  debitAccount: string;
  debitName: string;
  debitAmount: number;
  creditAccount: string;
  creditName: string;
  creditAmount: number;
  transactionId: string;
}

/**
 * 仕訳帳: 時系列の仕訳一覧
 * Transactionをペア化(借方と貸方を1行に)
 */
export async function getJournalBook(fiscalYear?: number): Promise<JournalRow[]> {
  const transactions = await listTransactions();
  console.log("[DEBUG] 全取引件数:", transactions.length);
  const typeCount: Record<string, number> = {};
  for (const t of transactions) {
    typeCount[t.type] = (typeCount[t.type] || 0) + 1;
  }
  console.log("[DEBUG] type分布:", typeCount);
  const expense_first_3 = transactions.filter((t) => t.type === "expense").slice(0, 3);
  console.log("[DEBUG] expense first 3:", JSON.stringify(expense_first_3.map((t) => ({
    desc: t.description.slice(0, 30), amount: t.amount, accountCode: t.accountCode, note: (t.note || "").slice(0, 30)
  })), null, 2));
  const filtered = fiscalYear
    ? transactions.filter((t) => new Date(t.date).getFullYear() === fiscalYear)
    : transactions;

  const entries = await bulkTransactionToJournal(filtered);

  // transactionId でグルーピングして借方/貸方ペア化
  const grouped: Record<string, JournalEntry[]> = {};
  for (const e of entries) {
    if (!grouped[e.transactionId]) grouped[e.transactionId] = [];
    grouped[e.transactionId].push(e);
  }

  const rows: JournalRow[] = [];
  for (const t of filtered) {
    const txEntries = grouped[t.id] || [];
    const debits = txEntries.filter((e) => e.debit > 0);
    const credits = txEntries.filter((e) => e.credit > 0);

    // 借方と貸方を1行ずつペア化(同じ件数になることを想定)
    const max = Math.max(debits.length, credits.length);
    for (let i = 0; i < max; i++) {
      const d = debits[i];
      const c = credits[i];
      const dAcc = d ? getAccountByCode(d.accountId) : undefined;
      const cAcc = c ? getAccountByCode(c.accountId) : undefined;
      rows.push({
        date: t.date,
        description: t.description,
        debitAccount: d?.accountId || "",
        debitName: dAcc?.name || d?.accountId || "",
        debitAmount: d?.debit || 0,
        creditAccount: c?.accountId || "",
        creditName: cAcc?.name || c?.accountId || "",
        creditAmount: c?.credit || 0,
        transactionId: t.id,
      });
    }
  }

  // 日付昇順
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

// =============== 総勘定元帳 ===============
export interface LedgerEntry {
  date: string;
  description: string;
  counterAccount: string;
  counterAccountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountLedger {
  accountCode: string;
  accountName: string;
  category: string;
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

/**
 * 総勘定元帳: 勘定科目別の取引履歴と残高推移
 */
export async function getGeneralLedger(fiscalYear: number = 2026): Promise<AccountLedger[]> {
  const transactions = await listTransactions();
  const filtered = transactions.filter((t) => new Date(t.date).getFullYear() === fiscalYear);
  const entries = await bulkTransactionToJournal(filtered);

  const settings = await loadSettings();
  const openings = (settings.openingBalances || []).filter((o) => o.fiscalYear === fiscalYear);
  const openingMap: Record<string, number> = {};
  for (const o of openings) openingMap[o.accountCode] = o.amount;

  // 全勘定科目をスキャン
  const ledgers: AccountLedger[] = [];

  for (const acc of JOURNAL_ACCOUNTS) {
    const accEntries = entries.filter((e) => e.accountId === acc.code);
    if (accEntries.length === 0 && !openingMap[acc.code]) continue;

    // 日付順
    const txMap: Record<string, Transaction> = {};
    for (const t of filtered) txMap[t.id] = t;
    accEntries.sort((a, b) => {
      const ta = txMap[a.transactionId]?.date || "";
      const tb = txMap[b.transactionId]?.date || "";
      return ta.localeCompare(tb);
    });

    let balance = openingMap[acc.code] || 0;
    let totalDebit = 0;
    let totalCredit = 0;
    const ledgerRows: LedgerEntry[] = [];

    for (const e of accEntries) {
      const tx = txMap[e.transactionId];
      if (!tx) continue;

      // 相手勘定科目(同じtransactionの反対側)を探す
      const counterpart = entries.find(
        (x) => x.transactionId === e.transactionId &&
               x.accountId !== e.accountId &&
               ((e.debit > 0 && x.credit > 0) || (e.credit > 0 && x.debit > 0))
      );
      const counterAccount = counterpart?.accountId || "";
      const counterAccountDef = getAccountByCode(counterAccount);

      // 残高計算(資産・費用は借方残高、負債・純資産・収益は貸方残高)
      const isDebitNormal = acc.category === "asset" || acc.category === "expense";
      if (isDebitNormal) {
        balance += e.debit - e.credit;
      } else {
        balance += e.credit - e.debit;
      }

      totalDebit += e.debit;
      totalCredit += e.credit;

      ledgerRows.push({
        date: tx.date,
        description: tx.description,
        counterAccount,
        counterAccountName: counterAccountDef?.name || counterAccount,
        debit: e.debit,
        credit: e.credit,
        balance,
      });
    }

    ledgers.push({
      accountCode: acc.code,
      accountName: acc.name,
      category: acc.category,
      openingBalance: openingMap[acc.code] || 0,
      entries: ledgerRows,
      closingBalance: balance,
      totalDebit,
      totalCredit,
    });
  }

  return ledgers;
}

// =============== 試算表 ===============
export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  fiscalYear: number;
}

/**
 * 残高試算表: 各勘定科目の借方合計・貸方合計・残高
 */
export async function getTrialBalance(fiscalYear: number = 2026): Promise<TrialBalance> {
  const ledgers = await getGeneralLedger(fiscalYear);
  const rows: TrialBalanceRow[] = ledgers.map((l) => ({
    accountCode: l.accountCode,
    accountName: l.accountName,
    category: l.category,
    debit: l.totalDebit,
    credit: l.totalCredit,
    balance: l.closingBalance,
  }));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return { rows, totalDebit, totalCredit, fiscalYear };
}

// =============== 損益計算書(P/L) ===============
export interface PLData {
  fiscalYear: number;
  revenue: { account: string; name: string; amount: number }[];
  totalRevenue: number;
  expenses: { account: string; name: string; amount: number }[];
  totalExpense: number;
  netIncome: number;
}

export async function getProfitLoss(fiscalYear: number = 2026): Promise<PLData> {
  const ledgers = await getGeneralLedger(fiscalYear);

  const revenue = ledgers
    .filter((l) => l.category === "revenue")
    .map((l) => ({ account: l.accountCode, name: l.accountName, amount: l.closingBalance }));
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);

  const expenses = ledgers
    .filter((l) => l.category === "expense")
    .map((l) => ({ account: l.accountCode, name: l.accountName, amount: l.closingBalance }));
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);

  return {
    fiscalYear,
    revenue,
    totalRevenue,
    expenses,
    totalExpense,
    netIncome: totalRevenue - totalExpense,
  };
}

// =============== 貸借対照表(B/S) ===============
export interface BSData {
  fiscalYear: number;
  assets: { account: string; name: string; amount: number }[];
  totalAssets: number;
  liabilities: { account: string; name: string; amount: number }[];
  totalLiabilities: number;
  equity: { account: string; name: string; amount: number }[];
  totalEquity: number;
  netIncome: number;
}

export async function getBalanceSheet(fiscalYear: number = 2026): Promise<BSData> {
  const ledgers = await getGeneralLedger(fiscalYear);

  const assets = ledgers
    .filter((l) => l.category === "asset" && l.closingBalance !== 0)
    .map((l) => ({ account: l.accountCode, name: l.accountName, amount: l.closingBalance }));
  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);

  const liabilities = ledgers
    .filter((l) => l.category === "liability" && l.closingBalance !== 0)
    .map((l) => ({ account: l.accountCode, name: l.accountName, amount: l.closingBalance }));
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);

  const equity = ledgers
    .filter((l) => l.category === "equity" && l.closingBalance !== 0)
    .map((l) => ({ account: l.accountCode, name: l.accountName, amount: l.closingBalance }));
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0);

  // 当期純利益 = 収益 - 費用
  const pl = await getProfitLoss(fiscalYear);

  return {
    fiscalYear,
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    totalEquity,
    netIncome: pl.netIncome,
  };
}
