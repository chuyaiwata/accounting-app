"use server";

import { auth } from "@/auth";
import {
  ensureAppFolder,
  uploadTextFile,
} from "@/lib/drive/client";
import type { AppSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/data/defaultSettings";
import { revalidatePath } from "next/cache";

const SETTINGS_FILE = "settings.json";

async function requireAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("認証が必要です。再度ログインしてください。");
  }
  return session.accessToken;
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const fetchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${SETTINGS_FILE}'+and+'${folderId}'+in+parents+and+trashed=false&fields=files(id,name)`;
    const listRes = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) throw new Error("Drive APIエラー");
    const listJson = (await listRes.json()) as { files: { id: string }[] };

    if (listJson.files.length === 0) {
      return DEFAULT_SETTINGS;
    }

    const fileId = listJson.files[0].id;
    const contentRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!contentRes.ok) throw new Error("ファイル取得エラー");
    const text = await contentRes.text();
    if (!text.trim()) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(text) as AppSettings;
    return {
      businessTags:
        parsed.businessTags && parsed.businessTags.length > 0
          ? parsed.businessTags
          : DEFAULT_SETTINGS.businessTags,
      apportionRules: parsed.apportionRules || [],
      accounts:
        parsed.accounts && parsed.accounts.length > 0
          ? parsed.accounts
          : DEFAULT_SETTINGS.accounts,
      gmailWhitelist:
        parsed.gmailWhitelist && parsed.gmailWhitelist.length > 0
          ? parsed.gmailWhitelist
          : DEFAULT_SETTINGS.gmailWhitelist,
      bankAccount: parsed.bankAccount || DEFAULT_SETTINGS.bankAccount,
      updatedAt: parsed.updatedAt || DEFAULT_SETTINGS.updatedAt,
    };
  } catch (e) {
    console.error("loadSettings error:", e);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(
  settings: Omit<AppSettings, "updatedAt">
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    const folderId = await ensureAppFolder(accessToken);

    const full: AppSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    await uploadTextFile(
      accessToken,
      folderId,
      SETTINGS_FILE,
      JSON.stringify(full, null, 2)
    );

    revalidatePath("/");
    revalidatePath("/transactions");
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存に失敗しました";
    console.error("saveSettings error:", e);
    return { ok: false, error: message };
  }
}
