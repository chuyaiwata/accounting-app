"use server";

import { auth } from "@/auth";
import {
  listMessages,
  getMessage,
  getAttachment,
  getHeader,
  extractBodyText,
  extractPdfAttachments,
} from "@/lib/gmail/client";
import {
  ensureAppFolder,
  ensureSubFolder,
  uploadBinaryFile,
} from "@/lib/drive/client";
import { loadSettings } from "@/lib/actions/settings";
import type { ImportRow, GmailWhitelistEntry } from "@/lib/types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5";

interface GmailExtractResult {
  amount?: number;
  date?: string;        // YYYY-MM-DD
  serviceName?: string; // 検出したサービス名
  description?: string; // 取引説明
  isInvoice: boolean;   // 請求書/領収書か
  reason?: string;      // 抽出できない理由(isInvoice=falseの場合)
}

function makeHash(date: string, amount: number, description: string): string {
  const src = date + "|" + amount + "|" + description;
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return "gmail_" + Math.abs(hash).toString(36);
}

/**
 * Gmail から請求書/領収書メールを検索 → 構造化抽出 → ImportRow 配列を返す
 */
export async function parseGmailEmails(
  daysAgo: number = 90
): Promise<{ ok: true; rows: ImportRow[]; processedCount: number } | { ok: false; error: string }> {
  try {
    const session = await auth();
    const accessToken = session?.accessToken;
    if (!accessToken) {
      return { ok: false, error: "認証が必要です" };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "ANTHROPIC_API_KEY が設定されていません" };
    }

    // 設定からホワイトリストを取得
    const settings = await loadSettings();
    const enabledWhitelist = settings.gmailWhitelist.filter((e: GmailWhitelistEntry) => e.enabled);

    if (enabledWhitelist.length === 0) {
      return { ok: false, error: "有効なホワイトリストエントリがありません" };
    }

    // Drive準備(PDF保管用)
    const appFolderId = await ensureAppFolder(accessToken);
    const receiptsFolderId = await ensureSubFolder(
      accessToken,
      appFolderId,
      "receipts"
    );

    // メール検索クエリを構築
    const date = new Date(Date.now() - daysAgo * 86400000);
    const afterStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

    // 全ホワイトリストエントリからメッセージを収集
    const allMessages: { messageId: string; entry: GmailWhitelistEntry }[] = [];

    for (const entry of enabledWhitelist) {
      let query = `after:${afterStr}`;
      if (entry.matchType === "from") {
        query += ` from:${entry.matchValue}`;
      } else {
        query += ` subject:"${entry.matchValue}"`;
      }

      try {
        const messages = await listMessages(accessToken, query, 50);
        for (const m of messages) {
          allMessages.push({ messageId: m.id, entry });
        }
      } catch (e) {
        console.error(`検索失敗(${entry.name}):`, e);
      }
    }

    // 重複削除(同じメッセージが複数のエントリにマッチした場合は最初のエントリを使用)
    const uniqueMessages = new Map<string, GmailWhitelistEntry>();
    for (const { messageId, entry } of allMessages) {
      if (!uniqueMessages.has(messageId)) {
        uniqueMessages.set(messageId, entry);
      }
    }

    const allRows: ImportRow[] = [];
    const seenHashes = new Set<string>();
    let processedCount = 0;

    for (const [messageId, entry] of uniqueMessages) {
      try {
        // メール本体取得
        const message = await getMessage(accessToken, messageId);
        const subject = getHeader(message, "Subject");
        const from = getHeader(message, "From");
        const dateHeader = getHeader(message, "Date");
        const bodyText = extractBodyText(message);

        // 本文または件名+本文を Claude に投げて構造化抽出
        const extractResult = await extractWithClaude(
          apiKey,
          subject,
          from,
          bodyText,
          entry.name
        );

        processedCount++;

        if (!extractResult.isInvoice || !extractResult.amount) {
          continue; // 請求書じゃない、または金額抽出失敗
        }

        // 日付の決定(抽出 > メール日付)
        let txDate = extractResult.date;
        if (!txDate && dateHeader) {
          const parsed = new Date(dateHeader);
          if (!isNaN(parsed.getTime())) {
            txDate = parsed.toISOString().slice(0, 10);
          }
        }
        if (!txDate) continue;

        const description = extractResult.description || extractResult.serviceName || entry.name;
        const hash = makeHash(txDate, extractResult.amount, description);

        if (seenHashes.has(hash)) continue;
        seenHashes.add(hash);

        // PDF添付があれば Drive に保存
        let receiptUrl: string | undefined;
        const pdfs = extractPdfAttachments(message);
        if (pdfs.length > 0) {
          try {
            const pdf = pdfs[0]; // 最初のPDFのみ
            const attachment = await getAttachment(
              accessToken,
              messageId,
              pdf.attachmentId
            );
            // base64url → base64
            const normalized = attachment.data.replace(/-/g, "+").replace(/_/g, "/");
            const binary = atob(normalized);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const fileName = `${txDate}_gmail_${messageId}.pdf`;
            receiptUrl = await uploadBinaryFile(
              accessToken,
              receiptsFolderId,
              fileName,
              bytes,
              "application/pdf"
            );
          } catch (e) {
            console.error("PDF保存エラー:", e);
          }
        }

        allRows.push({
          rawHash: hash,
          rawDate: txDate,
          rawDescription: description,
          rawAmount: extractResult.amount,
          date: txDate,
          description,
          amount: extractResult.amount,
          type: "expense",
          category: entry.defaultCategory || "business",
          accountCode: entry.defaultAccountCode || undefined,
          tagIds: entry.defaultTagIds || [],
          paymentMethod: undefined,
          note: `[Gmail] ${subject.slice(0, 50)}`,
          receiptUrl,
          include: true,
          warning: receiptUrl ? undefined : "PDF添付なし(本文から抽出)",
        });
      } catch (e) {
        console.error(`メッセージ処理失敗(${messageId}):`, e);
      }
    }

    return { ok: true, rows: allRows, processedCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    console.error("parseGmailEmails error:", e);
    return { ok: false, error: msg };
  }
}

async function extractWithClaude(
  apiKey: string,
  subject: string,
  from: string,
  body: string,
  serviceName: string
): Promise<GmailExtractResult> {
  const prompt = `以下は ${serviceName} からのメールです。請求書/領収書かどうか判定し、該当する場合は金額・日付・サービス名を抽出してください。

件名: ${subject}
差出人: ${from}

本文(冒頭2000文字):
${body.slice(0, 2000)}

以下のJSON形式のみで回答してください(説明文不要):
{
  "isInvoice": true | false,
  "amount": 数値(円、税込み合計、抽出できなければ省略),
  "date": "YYYY-MM-DD"(支払日 or 請求日、抽出できなければ省略),
  "serviceName": "サービス名"(例: 東京ガス、ソフトバンク光),
  "description": "取引説明"(例: 5月分電気料金),
  "reason": "isInvoice=falseの場合のみ、その理由"
}

判定基準:
- 請求書・領収書・利用明細・カード支払案内 → isInvoice: true
- 単なるお知らせ・宣伝・キャンペーン → isInvoice: false
- 金額が明記されてない通知 → isInvoice: false`;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return { isInvoice: false, reason: "Claude API エラー" };
    }

    const data = await response.json();
    const textBlock = data.content?.find((c: { type: string; text?: string }) => c.type === "text");
    if (!textBlock?.text) {
      return { isInvoice: false, reason: "Claude応答が空" };
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isInvoice: false, reason: "JSON抽出失敗" };
    }

    return JSON.parse(jsonMatch[0]) as GmailExtractResult;
  } catch (e) {
    console.error("Claude API 呼び出しエラー:", e);
    return { isInvoice: false, reason: "API呼び出し失敗" };
  }
}
