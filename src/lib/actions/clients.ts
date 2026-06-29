"use server";

import { auth } from "@/auth";
import {
  ensureAppFolder,
  appendJsonl,
  readJsonl,
  uploadTextFile,
} from "@/lib/drive/client";
import type { Counterparty, CounterpartyType } from "@/lib/types";
import { revalidatePath } from "next/cache";

const FILE = "counterparties.jsonl";

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

export async function listCounterparties(): Promise<Counterparty[]> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);
    return await readJsonl<Counterparty>(accessToken, folderId, FILE);
  } catch (e) {
    console.error("listCounterparties error:", e);
    return [];
  }
}

interface CounterpartyInput {
  name: string;
  type: CounterpartyType;
  postalCode?: string;
  email?: string;
  address?: string;
  tNumber?: string;
  withholdingDefault: boolean;
  note?: string;
}

export async function addCounterparty(
  input: CounterpartyInput
): Promise<{ ok: boolean; error?: string; counterparty?: Counterparty }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    if (!input.name) return { ok: false, error: "取引先名が必須です" };

    const cp: Counterparty = {
      id: generateId(),
      name: input.name,
      type: input.type,
      postalCode: input.postalCode,
      email: input.email,
      address: input.address,
      tNumber: input.tNumber,
      withholdingDefault: input.withholdingDefault,
      note: input.note,
      createdAt: new Date().toISOString(),
    };

    await appendJsonl(accessToken, folderId, FILE, cp);
    revalidatePath("/clients");
    revalidatePath("/invoices");
    return { ok: true, counterparty: cp };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失敗";
    console.error("addCounterparty error:", e);
    return { ok: false, error: msg };
  }
}

export async function updateCounterparty(
  id: string,
  input: CounterpartyInput
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const items = await readJsonl<Counterparty>(accessToken, folderId, FILE);
    const idx = items.findIndex((c) => c.id === id);
    if (idx === -1) return { ok: false, error: "取引先が見つかりません" };

    items[idx] = {
      ...items[idx],
      name: input.name,
      type: input.type,
      postalCode: input.postalCode,
      email: input.email,
      address: input.address,
      tNumber: input.tNumber,
      withholdingDefault: input.withholdingDefault,
      note: input.note,
    };

    const content = items.map((c) => JSON.stringify(c)).join("\n") + "\n";
    await uploadTextFile(accessToken, folderId, FILE, content);

    revalidatePath("/clients");
    revalidatePath("/invoices");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新失敗";
    console.error("updateCounterparty error:", e);
    return { ok: false, error: msg };
  }
}

export async function deleteCounterparty(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const items = await readJsonl<Counterparty>(accessToken, folderId, FILE);
    const filtered = items.filter((c) => c.id !== id);

    const content =
      filtered.map((c) => JSON.stringify(c)).join("\n") + (filtered.length > 0 ? "\n" : "");
    await uploadTextFile(accessToken, folderId, FILE, content);

    revalidatePath("/clients");
    revalidatePath("/invoices");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "削除失敗";
    console.error("deleteCounterparty error:", e);
    return { ok: false, error: msg };
  }
}
