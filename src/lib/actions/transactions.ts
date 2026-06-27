"use server";

import { auth } from "@/auth";
import {
  ensureAppFolder,
  appendJsonl,
  readJsonl,
  uploadTextFile,
} from "@/lib/drive/client";
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
  TaxDeductionType,
  SettlementStatus,
} from "@/lib/types";
import { revalidatePath } from "next/cache";

const TRANSACTIONS_FILE = "transactions.jsonl";

function generateId(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 11)
  );
}

async function requireAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("認証が必要です。再度ログインしてください。");
  }
  return session.accessToken;
}

export async function addTransaction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const accessToken = await requireAccessToken();

    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
    const amountStr = formData.get("amount") as string;
    const type = formData.get("type") as TransactionType;
    const category = formData.get("category") as TransactionCategory;
    const taxDeductionType = formData.get("taxDeductionType") as TaxDeductionType | null;
    const settlementStatus = (formData.get("settlementStatus") as SettlementStatus) || "settled";
    const expectedSettlementDate = formData.get("expectedSettlementDate") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    const note = formData.get("note") as string;
    const tagIds = formData.getAll("tagIds") as string[];
    const accountCode = formData.get("accountCode") as string | null;

    if (!date || !description || !amountStr || !type || !category) {
      return { ok: false, error: "必須項目が入力されていません" };
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { ok: false, error: "金額は正の数を入力してください" };
    }

    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: generateId(),
      date,
      description,
      amount,
      category,
      type,
      source: "manual",
      status: "confirmed",
      taxDeductionType: taxDeductionType || undefined,
      settlementStatus,
      expectedSettlementDate: expectedSettlementDate || undefined,
      actualSettlementDate:
        settlementStatus === "settled" ? date : undefined,
      tagIds: tagIds || [],
      accountCode: accountCode || undefined,
      paymentMethod: paymentMethod || undefined,
      note: note || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const folderId = await ensureAppFolder(accessToken);
    await appendJsonl(accessToken, folderId, TRANSACTIONS_FILE, transaction);

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存に失敗しました";
    console.error("addTransaction error:", e);
    return { ok: false, error: message };
  }
}

export async function listTransactions(): Promise<Transaction[]> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);
    const items = await readJsonl<Transaction>(
      accessToken,
      folderId,
      TRANSACTIONS_FILE
    );
    return items.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch (e) {
    console.error("listTransactions error:", e);
    return [];
  }
}

export async function settleTransaction(
  transactionId: string,
  actualDate: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const items = await readJsonl<Transaction>(
      accessToken,
      folderId,
      TRANSACTIONS_FILE
    );

    const idx = items.findIndex((t) => t.id === transactionId);
    if (idx === -1) {
      return { ok: false, error: "取引が見つかりません" };
    }

    items[idx] = {
      ...items[idx],
      settlementStatus: "settled",
      actualSettlementDate: actualDate,
      updatedAt: new Date().toISOString(),
    };

    const newContent =
      items.map((t) => JSON.stringify(t)).join("\n") + "\n";
    await uploadTextFile(accessToken, folderId, TRANSACTIONS_FILE, newContent);

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新に失敗しました";
    console.error("settleTransaction error:", e);
    return { ok: false, error: message };
  }
}

export async function deleteTransaction(
  transactionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const items = await readJsonl<Transaction>(
      accessToken,
      folderId,
      TRANSACTIONS_FILE
    );

    const filtered = items.filter((t) => t.id !== transactionId);
    if (filtered.length === items.length) {
      return { ok: false, error: "取引が見つかりません" };
    }

    const newContent =
      filtered.length === 0
        ? ""
        : filtered.map((t) => JSON.stringify(t)).join("\n") + "\n";
    await uploadTextFile(accessToken, folderId, TRANSACTIONS_FILE, newContent);

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "削除に失敗しました";
    console.error("deleteTransaction error:", e);
    return { ok: false, error: message };
  }
}

export async function updateTransaction(
  transactionId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const items = await readJsonl<Transaction>(
      accessToken,
      folderId,
      TRANSACTIONS_FILE
    );

    const idx = items.findIndex((t) => t.id === transactionId);
    if (idx === -1) {
      return { ok: false, error: "取引が見つかりません" };
    }

    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
    const amountStr = formData.get("amount") as string;
    const type = formData.get("type") as TransactionType;
    const category = formData.get("category") as TransactionCategory;
    const taxDeductionType = formData.get("taxDeductionType") as TaxDeductionType | null;
    const settlementStatus = (formData.get("settlementStatus") as SettlementStatus) || "settled";
    const expectedSettlementDate = formData.get("expectedSettlementDate") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    const note = formData.get("note") as string;
    const tagIds = formData.getAll("tagIds") as string[];
    const accountCode = formData.get("accountCode") as string | null;

    if (!date || !description || !amountStr || !type || !category) {
      return { ok: false, error: "必須項目が入力されていません" };
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { ok: false, error: "金額は正の数を入力してください" };
    }

    const existing = items[idx];
    items[idx] = {
      ...existing,
      date,
      description,
      amount,
      category,
      type,
      taxDeductionType: taxDeductionType || undefined,
      settlementStatus,
      expectedSettlementDate: expectedSettlementDate || undefined,
      actualSettlementDate:
        settlementStatus === "settled"
          ? existing.actualSettlementDate || date
          : undefined,
      tagIds: tagIds || [],
      accountCode: accountCode || undefined,
      paymentMethod: paymentMethod || undefined,
      note: note || undefined,
      updatedAt: new Date().toISOString(),
    };

    const newContent =
      items.map((t) => JSON.stringify(t)).join("\n") + "\n";
    await uploadTextFile(accessToken, folderId, TRANSACTIONS_FILE, newContent);

    revalidatePath("/");
    revalidatePath("/transactions");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新に失敗しました";
    console.error("updateTransaction error:", e);
    return { ok: false, error: message };
  }
}
