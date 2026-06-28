"use server";

import { auth } from "@/auth";
import {
  ensureAppFolder,
  appendJsonl,
  readJsonl,
  uploadTextFile,
} from "@/lib/drive/client";
import type { Invoice, InvoiceItem, Transaction } from "@/lib/types";
import { revalidatePath } from "next/cache";

const INVOICES_FILE = "invoices.jsonl";
const TRANSACTIONS_FILE = "transactions.jsonl";

function generateId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 11);
}

async function requireAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("認証が必要です");
  }
  return session.accessToken;
}

async function generateInvoiceNo(
  accessToken: string,
  folderId: string,
  issueDate: string
): Promise<string> {
  const items = await readJsonl<Invoice>(accessToken, folderId, INVOICES_FILE);
  const ymPrefix = issueDate.slice(0, 7).replace("-", "");

  const sameMonth = items.filter((inv) =>
    inv.invoiceNo.startsWith(ymPrefix + "-")
  );

  let maxNum = 0;
  for (const inv of sameMonth) {
    const suffix = inv.invoiceNo.split("-")[1];
    const n = parseInt(suffix);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  }

  return ymPrefix + "-" + String(maxNum + 1).padStart(3, "0");
}

export async function listInvoices(): Promise<Invoice[]> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);
    return await readJsonl<Invoice>(accessToken, folderId, INVOICES_FILE);
  } catch (e) {
    console.error("listInvoices error:", e);
    return [];
  }
}

interface InvoiceInput {
  counterpartyId: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  withholdingTaxRate: number;
  note?: string;
  tagId?: string;
}

function calcInvoiceAmounts(items: InvoiceItem[], withholdingTaxRate: number) {
  let subtotal = 0;
  let taxAmount = 0;
  for (const item of items) {
    const itemSubtotal = item.quantity * item.unitPrice;
    subtotal += itemSubtotal;
    taxAmount += Math.floor(itemSubtotal * item.taxRate / 100);
  }
  const total = subtotal + taxAmount;
  const withholdingAmount = Math.floor(total * withholdingTaxRate / 100);
  const transferAmount = total - withholdingAmount;
  return { subtotal, taxAmount, total, withholdingAmount, transferAmount };
}

export async function addInvoice(input: InvoiceInput): Promise<{ ok: boolean; error?: string; invoice?: Invoice }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    if (input.items.length === 0) {
      return { ok: false, error: "明細を1件以上追加してください" };
    }

    const amounts = calcInvoiceAmounts(input.items, input.withholdingTaxRate);
    const invoiceNo = await generateInvoiceNo(accessToken, folderId, input.issueDate);
    const now = new Date().toISOString();

    const invoice: Invoice = {
      id: generateId(),
      invoiceNo,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      counterpartyId: input.counterpartyId,
      tagId: input.tagId,
      items: input.items,
      subtotal: amounts.subtotal,
      taxAmount: amounts.taxAmount,
      withholdingAmount: amounts.withholdingAmount,
      total: amounts.total,
      transferAmount: amounts.transferAmount,
      status: "draft",
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };

    await appendJsonl(accessToken, folderId, INVOICES_FILE, invoice);
    revalidatePath("/invoices");

    return { ok: true, invoice };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失敗";
    console.error("addInvoice error:", e);
    return { ok: false, error: msg };
  }
}

export async function updateInvoice(
  invoiceId: string,
  input: InvoiceInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const items = await readJsonl<Invoice>(accessToken, folderId, INVOICES_FILE);
    const idx = items.findIndex((inv) => inv.id === invoiceId);
    if (idx === -1) {
      return { ok: false, error: "請求書が見つかりません" };
    }

    if (input.items.length === 0) {
      return { ok: false, error: "明細を1件以上追加してください" };
    }

    const amounts = calcInvoiceAmounts(input.items, input.withholdingTaxRate);

    items[idx] = {
      ...items[idx],
      counterpartyId: input.counterpartyId,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      tagId: input.tagId,
      items: input.items,
      subtotal: amounts.subtotal,
      taxAmount: amounts.taxAmount,
      withholdingAmount: amounts.withholdingAmount,
      total: amounts.total,
      transferAmount: amounts.transferAmount,
      note: input.note,
      updatedAt: new Date().toISOString(),
    };

    const content = items.map((inv) => JSON.stringify(inv)).join("\n") + "\n";
    await uploadTextFile(accessToken, folderId, INVOICES_FILE, content);

    revalidatePath("/invoices");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新失敗";
    console.error("updateInvoice error:", e);
    return { ok: false, error: msg };
  }
}

export async function deleteInvoice(invoiceId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const items = await readJsonl<Invoice>(accessToken, folderId, INVOICES_FILE);
    const filtered = items.filter((inv) => inv.id !== invoiceId);

    const content = filtered.map((inv) => JSON.stringify(inv)).join("\n") + (filtered.length > 0 ? "\n" : "");
    await uploadTextFile(accessToken, folderId, INVOICES_FILE, content);

    revalidatePath("/invoices");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "削除失敗";
    console.error("deleteInvoice error:", e);
    return { ok: false, error: msg };
  }
}

export async function markInvoicePaid(invoiceId: string, paymentDate: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const invoices = await readJsonl<Invoice>(accessToken, folderId, INVOICES_FILE);
    const idx = invoices.findIndex((inv) => inv.id === invoiceId);
    if (idx === -1) {
      return { ok: false, error: "請求書が見つかりません" };
    }

    const invoice = invoices[idx];
    if (invoice.status === "paid") {
      return { ok: false, error: "既に入金済みです" };
    }

    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: generateId(),
      date: paymentDate,
      description: "請求書 " + invoice.invoiceNo + " 入金",
      amount: invoice.transferAmount,
      category: "business",
      type: "income",
      source: "manual",
      status: "confirmed",
      settlementStatus: "settled",
      actualSettlementDate: paymentDate,
      tagIds: invoice.tagId ? [invoice.tagId] : [],
      accountCode: "411",
      note: "請求書 " + invoice.invoiceNo,
      createdAt: now,
      updatedAt: now,
    };

    await appendJsonl(accessToken, folderId, TRANSACTIONS_FILE, transaction);

    invoices[idx] = {
      ...invoice,
      status: "paid",
      transactionId: transaction.id,
      updatedAt: now,
    };

    const content = invoices.map((inv) => JSON.stringify(inv)).join("\n") + "\n";
    await uploadTextFile(accessToken, folderId, INVOICES_FILE, content);

    revalidatePath("/invoices");
    revalidatePath("/transactions");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "処理失敗";
    console.error("markInvoicePaid error:", e);
    return { ok: false, error: msg };
  }
}
