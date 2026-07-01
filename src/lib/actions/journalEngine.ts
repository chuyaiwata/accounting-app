"use server";

import type { Transaction, JournalEntry, ID } from "@/lib/types";
import { JOURNAL_ACCOUNTS } from "@/lib/data/journalAccounts";
import { loadSettings } from "./settings";

const CATEGORY_TO_ACCOUNT: Record<string, string> = {
  // 売上
  "売上": "sales", "売上高": "sales", "コーチング": "sales", "レッスン": "sales",
  // 地代家賃
  "地代家賃": "rent", "家賃": "rent", "賃料": "rent",
  // 水道光熱費
  "水道光熱費": "utilities", "電気": "utilities", "ガス": "utilities", "水道": "utilities",
  // 通信費
  "通信費": "communication", "携帯": "communication", "インターネット": "communication",
  "サブスクリプション": "communication", "Apple": "communication", "iCloud": "communication",
  "Claude": "communication", "ChatGPT": "communication", "GitHub": "communication",
  // 旅費交通費
  "旅費交通費": "transportation", "交通費": "transportation", "電車": "transportation",
  "タクシー": "transportation", "Suica": "transportation",
  // 接待交際費
  "接待交際費": "entertainment", "交際費": "entertainment", "飲食": "entertainment",
  // 消耗品費
  "消耗品費": "supplies", "消耗品": "supplies",
  // 広告宣伝費
  "広告宣伝費": "ad_marketing",
  // 新聞図書費
  "新聞図書費": "book_education", "書籍": "book_education", "本": "book_education",
  // 外注工賃
  "外注工賃": "outsourcing",
  // 租税公課
  "租税公課": "tax_public", "税": "tax_public",
  // 保険料
  "損害保険料": "insurance",
  // 修繕費
  "修繕費": "repair",
  // 荷造運賃
  "荷造運賃": "freight",
  // 福利厚生費
  "福利厚生費": "welfare",
  // 減価償却費
  "減価償却費": "depreciation",
  // 諸会費
  "諸会費": "fee_dues",
  // 雑費(明確に経費としても勘定科目が決まらない)
  "雑費": "misc",
};

// 個人税金や国民保険などは「事業主貸」(プライベート経費)に分類
const OWNER_DRAWINGS_KEYWORDS = [
  "個人住民税", "住民税", "都民税", "区民税",
  "個人事業税", "事業税",
  "国民健康保険", "国保",
  "国民年金", "年金",
  "所得税",
];

function isOwnerDrawings(description: string): boolean {
  return OWNER_DRAWINGS_KEYWORDS.some((kw) => description.includes(kw));
}

const PAYMENT_TO_ACCOUNT: Record<string, string> = {
  "現金": "cash",
  "三菱UFJ": "bank_ufj", "UFJ": "bank_ufj", "普通預金": "bank_ufj",
  "ニコス": "unpaid_nicos", "三菱UFJニコス": "unpaid_nicos",
  "Heart One": "unpaid_heart_one",
  "PayPay": "emoney_paypay",
  "Suica": "emoney_suica",
  "ハチペイ": "emoney_hachipay",
};


// 旧コード(日本標準勘定科目コード) → 新コードへの変換
function resolveExpenseAccount(t: Transaction): string {
  // 事業主貸(個人税金や年金)を優先判定
  if (isOwnerDrawings(t.description)) return "owner_drawings";
  if (t.note && isOwnerDrawings(t.note)) return "owner_drawings";
  // accountCode が指定されてれば優先
  if (t.accountCode) { const normalized = t.accountCode; if (normalized && JOURNAL_ACCOUNTS.some((a) => a.code === normalized)) return normalized; }
  // description から推定
  if (t.description) {
    for (const key of Object.keys(CATEGORY_TO_ACCOUNT)) {
      if (t.description.includes(key)) return CATEGORY_TO_ACCOUNT[key];
    }
  }
  // note から推定(英語の description にも対応)
  if (t.note) {
    for (const key of Object.keys(CATEGORY_TO_ACCOUNT)) {
      if (t.note.includes(key)) return CATEGORY_TO_ACCOUNT[key];
    }
  }
  // 英語キーワード判定(Gmail取込メールから)
  const combined = (t.description + " " + (t.note || "")).toLowerCase();
  if (combined.includes("anthropic") || combined.includes("claude") ||
      combined.includes("openai") || combined.includes("chatgpt") ||
      combined.includes("github") || combined.includes("vercel") ||
      combined.includes("apple") || combined.includes("icloud") ||
      combined.includes("microsoft") || combined.includes("slack") ||
      combined.includes("notion") || combined.includes("figma") ||
      combined.includes("adobe") || combined.includes("subscription")) {
    return "communication";
  }
  if (combined.includes("uber") || combined.includes("taxi") ||
      combined.includes("transport") || combined.includes("transit") ||
      combined.includes("airalo")) {
    return "transportation";
  }
  if (combined.includes("amazon") || combined.includes("rakuten")) {
    return "supplies";
  }
  return "misc";
}

function resolvePaymentAccount(t: Transaction): string {
  // 1. paymentMethod から推定
  if (t.paymentMethod) {
    const key = Object.keys(PAYMENT_TO_ACCOUNT).find((k) => t.paymentMethod!.includes(k));
    if (key) return PAYMENT_TO_ACCOUNT[key];
  }
  // 2. note から推定(Gmail取込の場合)
  if (t.note) {
    if (t.note.includes("Gmail")) {
      // Gmailから取り込まれた = カード払いの可能性高
      return "unpaid_nicos";
    }
    if (t.note.includes("Suica")) return "emoney_suica";
    if (t.note.includes("ニコス") || t.note.includes("カード")) return "unpaid_nicos";
    if (t.note.includes("UFJ") || t.note.includes("銀行")) return "bank_ufj";
    if (t.note.includes("Heart One")) return "unpaid_heart_one";
  }
  // 3. description から推定
  if (t.description) {
    if (t.description.includes("Suica")) return "emoney_suica";
    if (t.description.includes("PayPay")) return "emoney_paypay";
  }
  // 4. デフォルト: 普通預金 (現金よりは普通預金の方が一般的)
  return "bank_ufj";
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
      debit: Math.round(t.amount),
      credit: 0,
      taxAmount, taxRate, allocationRatio,
    });
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: "sales",
      debit: 0,
      credit: Math.round(t.amount),
      taxAmount, taxRate, allocationRatio,
    });
  } else if (t.type === "expense") {
    const expenseAccount = resolveExpenseAccount(t);
    const paymentAccount = resolvePaymentAccount(t);

    // 家事按分ルール適用
    const settings = await loadSettings();
    const rule = settings.apportionRules.find((r) => r.accountCode === expenseAccount);
    const ratio = rule && rule.businessRatio > 0 && rule.businessRatio < 1
      ? rule.businessRatio
      : 1.0;
    const totalAmount = Math.round(t.amount);
    const businessAmount = Math.round(totalAmount * ratio);
    const personalAmount = totalAmount - businessAmount;

    // 借方: 費用(事業分) + 事業主貸(家事分) / 貸方: 支払元(満額)
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: expenseAccount,
      debit: businessAmount,
      credit: 0,
      taxAmount, taxRate, allocationRatio: ratio,
    });
    if (personalAmount > 0) {
      entries.push({
        id: generateId(),
        transactionId: t.id,
        accountId: "owner_drawings",
        debit: personalAmount,
        credit: 0,
        taxAmount, taxRate, allocationRatio: 1 - ratio,
      });
    }
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: paymentAccount,
      debit: 0,
      credit: totalAmount,
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
      debit: Math.round(t.amount),
      credit: 0,
      taxAmount, taxRate, allocationRatio,
    });
    entries.push({
      id: generateId(),
      transactionId: t.id,
      accountId: fromAccount,
      debit: 0,
      credit: Math.round(t.amount),
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
