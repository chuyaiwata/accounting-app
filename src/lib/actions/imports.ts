"use server";

import { auth } from "@/auth";
import {
  ensureAppFolder,
  readJsonl,
  uploadTextFile,
} from "@/lib/drive/client";
import type { Transaction, ImportRow } from "@/lib/types";
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

type DuplicateResult = { rawHash: string; duplicateId: string };

export async function detectDuplicates(rows: ImportRow[]): Promise<DuplicateResult[]> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);
    const existing = await readJsonl<Transaction>(
      accessToken,
      folderId,
      TRANSACTIONS_FILE
    );

    const dups: DuplicateResult[] = [];

    for (const row of rows) {
      const exactMatch = existing.find((t) => t.rawHash === row.rawHash);
      if (exactMatch) {
        dups.push({ rawHash: row.rawHash, duplicateId: exactMatch.id });
        continue;
      }

      const fuzzyMatch = existing.find(
        (t) =>
          t.date === row.date &&
          t.amount === row.amount &&
          (t.description.includes(row.description.slice(0, 5)) ||
            row.description.includes(t.description.slice(0, 5)))
      );
      if (fuzzyMatch) {
        dups.push({ rawHash: row.rawHash, duplicateId: fuzzyMatch.id });
      }
    }

    return dups;
  } catch (e) {
    console.error("detectDuplicates error:", e);
    return [];
  }
}

export async function importTransactions(
  rows: ImportRow[]
): Promise<{ ok: boolean; imported: number; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const existing = await readJsonl<Transaction>(
      accessToken,
      folderId,
      TRANSACTIONS_FILE
    );

    const now = new Date().toISOString();
    const newTxns: Transaction[] = rows
      .filter((r) => r.include)
      .map((r) => {
        // カード払い(ニコス等)は未払金扱い、引落しは銀行CSV側で消込
        const isCardPayment = r.paymentMethod && /ニコス|カード|VISA|Master|JCB|Amex/i.test(r.paymentMethod);
        return {
          id: generateId(),
          date: r.date,
          description: r.description,
          amount: r.amount,
          category: r.category,
          type: r.type,
          source: "csv" as const,
          status: "confirmed" as const,
          settlementStatus: isCardPayment ? ("unpaid" as const) : ("settled" as const),
          actualSettlementDate: isCardPayment ? undefined : r.date,
          expectedSettlementDate: isCardPayment ? r.expectedSettlementDate : undefined,
          tagIds: r.tagIds,
          accountCode: r.accountCode,
          paymentMethod: r.paymentMethod,
          note: r.note,
          rawHash: r.rawHash,
          receiptUrl: r.receiptUrl,
          createdAt: now,
          updatedAt: now,
        };
      });

    if (newTxns.length === 0) {
      return { ok: true, imported: 0 };
    }

    const merged = [...existing, ...newTxns];
    const content = merged.map((t) => JSON.stringify(t)).join("\n") + "\n";

    await uploadTextFile(accessToken, folderId, TRANSACTIONS_FILE, content);

    revalidatePath("/");
    revalidatePath("/transactions");

    return { ok: true, imported: newTxns.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "取込に失敗しました";
    console.error("importTransactions error:", e);
    return { ok: false, imported: 0, error: message };
  }
}
