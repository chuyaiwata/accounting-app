// =============================================================================
// 取引のサーバーアクション
// =============================================================================
"use server";

import { auth } from "@/auth";
import {
  ensureAppFolder,
  appendJsonl,
  readJsonl,
} from "@/lib/drive/client";
import type { Transaction } from "@/lib/types";
import { revalidatePath } from "next/cache";

const TRANSACTIONS_FILE = "transactions.jsonl";

/**
 * ランダムなIDを生成(UUID風)
 */
function generateId(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 11)
  );
}

/**
 * 認証チェック + アクセストークン取得
 */
async function requireAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("認証が必要です。再度ログインしてください。");
  }
  return session.accessToken;
}

/**
 * 取引を1件追加
 */
export async function addTransaction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const accessToken = await requireAccessToken();

    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
    const amountStr = formData.get("amount") as string;
    const type = formData.get("type") as "income" | "expense";
    const note = formData.get("note") as string;

    if (!date || !description || !amountStr || !type) {
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
      type,
      source: "manual",
      status: "confirmed",
      tagIds: [],
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

/**
 * 取引を全件取得
 */
export async function listTransactions(): Promise<Transaction[]> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);
    const items = await readJsonl<Transaction>(
      accessToken,
      folderId,
      TRANSACTIONS_FILE
    );
    // 日付の降順(新しい順)で返す
    return items.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch (e) {
    console.error("listTransactions error:", e);
    return [];
  }
}