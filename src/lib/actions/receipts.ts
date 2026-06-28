"use server";

import { auth } from "@/auth";
import {
  ensureAppFolder,
  ensureSubFolder,
  uploadBinaryFile,
  deleteFile,
} from "@/lib/drive/client";

const RECEIPTS_SUBFOLDER = "receipts";

async function requireAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("認証が必要です。再度ログインしてください。");
  }
  return session.accessToken;
}

/**
 * レシート画像を Drive にアップロードして、ファイルIDを返す
 * ファイル名規約: YYYY-MM-DD_transactionId.jpg
 */
export async function uploadReceiptImage(
  date: string,
  transactionId: string,
  imageBase64: string,
  mimeType: string
): Promise<{ ok: true; fileId: string } | { ok: false; error: string }> {
  try {
    const accessToken = await requireAccessToken();
    const appFolderId = await ensureAppFolder(accessToken);
    const receiptsFolderId = await ensureSubFolder(
      accessToken,
      appFolderId,
      RECEIPTS_SUBFOLDER
    );

    // 拡張子を mimeType から決定
    let ext = "jpg";
    if (mimeType === "image/png") ext = "png";
    else if (mimeType === "image/webp") ext = "webp";

    const fileName = `${date}_${transactionId}.${ext}`;

    // base64 → Uint8Array に変換
    const binary = atob(imageBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const fileId = await uploadBinaryFile(
      accessToken,
      receiptsFolderId,
      fileName,
      bytes,
      mimeType
    );

    return { ok: true, fileId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
    console.error("uploadReceiptImage error:", e);
    return { ok: false, error: msg };
  }
}

/**
 * レシート画像を取得(プレビュー表示用)
 * 戻り値: base64 文字列(data URL形式)
 */
export async function getReceiptImage(
  fileId: string
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  try {
    const accessToken = await requireAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!res.ok) {
      throw new Error(`Drive取得失敗: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { ok: true, dataUrl: `data:${contentType};base64,${base64}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得に失敗しました";
    console.error("getReceiptImage error:", e);
    return { ok: false, error: msg };
  }
}

/**
 * レシート画像を削除
 */
export async function deleteReceiptImage(
  fileId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const accessToken = await requireAccessToken();
    await deleteFile(accessToken, fileId);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "削除に失敗しました";
    console.error("deleteReceiptImage error:", e);
    return { ok: false, error: msg };
  }
}
