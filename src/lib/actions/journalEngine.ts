"use server";

import type { Transaction, JournalEntry, ID } from "@/lib/types";

const CATEGORY_TO_ACCOUNT: Record<string, string> = {
  "売上": "sales", "売上高": "sales", "コーチング": "sales",
  "地代家賃": "rent", "家賃": "rent",
  "水道光熱費": "utilities", "電気": "utilities", "ガス": "utilities", "水道": "utilities",
  "通信費": "communication", "携帯": "communication", "インターネット": "communication",
  "旅費交通費": "transportation", "交通費": "transportation", "電車": "transportation", "タクシー": "transportation",
  "接待交際費": "entertainment", "交際費": "entertainment",
  "消耗品費": "supplies", "消耗品": "supplies",
  "広告宣伝費": "ad_marketing",
  "新聞図書費": "book_education", "書籍": "book_education",
  "外注工賃": "outsourcing",
  "租税公課": "tax_public",
  "保険料": "insurance", "損害保険料": "insurance",
  "修繕費": "repair",
  "荷造運賃": "freight",
  "福利厚生費": "welfare",
  "減価償却費": "depreciation",
  "諸会費": "fee_dues",
  "雑費": "misc",
};

const PAYMENT_TO_ACCOUNT: Record<string, string> = {
  "現金": "cash",
  "三菱UFJ": "bank_ufj", "UFJ": "bank_ufj", "普通預金": "bank_ufj",
  "ニコス": "unpaid_nicos", "三菱UFJニコス": "unpaid_nicos",
  "Heart One": "unpaid_heart_one",
  "PayPay": "emoney_paypay",
  "Suica": "emoney_suica",
  "ハチペイ": "emoney_hachipay",
};

function resolveExpenseAccount(t: Transaction): string {
  if (t.accountCode) return t.accountCode;
  if (t.description) {
    for (const key of Object.keys(CATEGORY_TO_ACCOUNT)) {
      if (t.description.includes(key)) return CATEGORY_TO_ACCOUNT[key];
    }
  }
  return "misc";
}

function resolvePaymentAccount(t: Transaction): string {
  if (!t.paymentMethod) return "cash";
  const key = Object.keys(PAYMENT_TO_ACCOUNT).find((k) => t.paymentMethod!.includes(k));
  return key ? PAYMENT_TO_ACCOUNT[key] : "cash";
}

function generateId(): ID {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 11);
}

/**
 * 1つの Transaction を JournalEntry の配列に変換
 * 既存型: { id, transactionId, accountId, debit, credit, taxAmount, taxRate, allocationRatio }
 *
 * 1取引で2レコード(借方と貸方をそれぞれ別レコード)
 */
export async function transactionToJournal(t: Transaction): Promise<JournalEntry[]> {
  const entries: JournalEntry[] = [];
  const taxRate = 0; // 免税事業者
  const taxAmount = 0;
  const allocationRatio = 1.0;

  if (t.type === "income") {
    const paymentAccount = resolvePaymentAccount(t);
    // 借方: 入金先 / 貸方: 売上高
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: paymentAccount,
      debit: t.amount,
      credit: 0,
      taxAmount, taxRate, allocationRatio,
    });
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: "sales",
      debit: 0,
      credit: t.amount,
      taxAmount, taxRate, allocationRatio,
    });
  } else if (t.type === "expense") {
    const expenseAccount = resolveExpenseAccount(t);
    const paymentAccount = resolvePaymentAccount(t);

    // 借方: 費用 / 貸方: 支払元
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: expenseAccount,
      debit: t.amount,
      credit: 0,
      taxAmount, taxRate, allocationRatio,
    });
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: paymentAccount,
      debit: 0,
      credit: t.amount,
      taxAmount, taxRate, allocationRatio,
    });
  } else if (t.type === "transfer") {
    // 振替(例: ニコス引落)
    const fromAccount = resolvePaymentAccount(t);
    const toAccount = t.note?.includes("ニコス引落")
      ? "unpaid_nicos"
      : t.accountCode || "misc";
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: toAccount,
      debit: t.amount,
      credit: 0,
      taxAmount, taxRate, allocationRatio,
    });
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: fromAccount,
      debit: 0,
      credit: t.amount,
      taxAmount, taxRate, allocationRatio,
    });
  }

  return entries;
}

export async function bulkTransactionToJournal(transactions: Transaction[]): Promise<JournalEntry[]> {
  const all: JournalEntry[] = [];
  for (const t of transactions) {
    const entries = await transactionToJournal(t);
    all.push(...entries);
  }
  return all;
}
