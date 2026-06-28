// =============================================================================
// Gmail API クライアント
// =============================================================================

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

interface GmailMessageList {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailPayload;
  internalDate?: string;
}

interface GmailPayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size: number; data?: string; attachmentId?: string };
  parts?: GmailPayload[];
}

interface GmailAttachment {
  size: number;
  data: string;
}

async function gmailRequest(
  accessToken: string,
  path: string
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GMAIL_API_BASE}${path}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * メール検索(クエリで絞り込み)
 * 例: from:tokyo-gas.co.jp after:2026/04/01
 */
export async function listMessages(
  accessToken: string,
  query: string,
  maxResults: number = 50
): Promise<{ id: string; threadId: string }[]> {
  const url = `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
  const res = await gmailRequest(accessToken, url);
  if (!res.ok) {
    throw new Error(`Gmail検索失敗: ${res.status}`);
  }
  const data = (await res.json()) as GmailMessageList;
  return data.messages || [];
}

/**
 * メール本体を取得(本文・ヘッダー・添付情報を含む)
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const url = `/users/me/messages/${messageId}?format=full`;
  const res = await gmailRequest(accessToken, url);
  if (!res.ok) {
    throw new Error(`Gmail取得失敗: ${res.status}`);
  }
  return (await res.json()) as GmailMessage;
}

/**
 * メール添付ファイルを取得
 */
export async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<GmailAttachment> {
  const url = `/users/me/messages/${messageId}/attachments/${attachmentId}`;
  const res = await gmailRequest(accessToken, url);
  if (!res.ok) {
    throw new Error(`Gmail添付取得失敗: ${res.status}`);
  }
  return (await res.json()) as GmailAttachment;
}

/**
 * メールのヘッダー値を取得
 */
export function getHeader(message: GmailMessage, name: string): string {
  const headers = message.payload?.headers || [];
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value || "";
}

/**
 * メールの本文テキストを抽出(Plain text or HTML)
 */
export function extractBodyText(message: GmailMessage): string {
  const payload = message.payload;
  if (!payload) return "";

  // 単一パート(text/plain)
  if (payload.body?.data && payload.mimeType?.startsWith("text/")) {
    return decodeBase64Url(payload.body.data);
  }

  // multipart の場合は parts を再帰探索
  function findText(parts: GmailPayload[]): string {
    // text/plain を優先
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // 次に text/html
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return stripHtml(html);
      }
    }
    // multipart の再帰
    for (const part of parts) {
      if (part.parts) {
        const found = findText(part.parts);
        if (found) return found;
      }
    }
    return "";
  }

  return payload.parts ? findText(payload.parts) : "";
}

/**
 * メールのPDF添付を抽出
 */
export function extractPdfAttachments(message: GmailMessage): {
  filename: string;
  attachmentId: string;
}[] {
  const results: { filename: string; attachmentId: string }[] = [];
  const payload = message.payload;
  if (!payload) return results;

  function findPdfs(parts: GmailPayload[]) {
    for (const part of parts) {
      if (
        part.mimeType === "application/pdf" &&
        part.body?.attachmentId &&
        part.filename
      ) {
        results.push({
          filename: part.filename,
          attachmentId: part.body.attachmentId,
        });
      }
      if (part.parts) findPdfs(part.parts);
    }
  }

  if (payload.parts) findPdfs(payload.parts);
  return results;
}

function decodeBase64Url(data: string): string {
  // Base64URL → 通常のBase64
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(normalized);
    // UTF-8 デコード
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    console.error("base64 decode error:", e);
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
