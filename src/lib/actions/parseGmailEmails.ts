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
import { loadSettings, saveSettings } from "@/lib/actions/settings";
import { ensureValidAccessToken } from "@/lib/gmail/refreshToken";
import type { ImportRow, GmailWhitelistEntry, GmailAccount } from "@/lib/types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5";

interface GmailExtractResult {
  amount?: number;
  date?: string;
  serviceName?: string;
  description?: string;
  isInvoice: boolean;
  reason?: string;
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

export async function parseGmailEmails(
  daysAgo: number = 90
): Promise<{ ok: true; rows: ImportRow[]; processedCount: number } | { ok: false; error: string }> {
  try {
    const session = await auth();
    const mainAccessToken = session?.accessToken;
    if (!mainAccessToken) {
      return { ok: false, error: "認証が必要です" };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "ANTHROPIC_API_KEY が設定されていません" };
    }

    const settings = await loadSettings();
    const enabledWhitelist = settings.gmailWhitelist.filter((e: GmailWhitelistEntry) => e.enabled);
    if (enabledWhitelist.length === 0) {
      return { ok: false, error: "有効なホワイトリストエントリがありません" };
    }

    // 対象アカウント一覧
    const userEmail = session.user?.email || "main";
    const additionalAccounts = (settings.gmailAccounts || []).filter((a) => a.enabled);

    interface TargetAccount {
      email: string;
      accessToken: string;
      account?: GmailAccount;
    }
    const allTargets: TargetAccount[] = [
      { email: userEmail, accessToken: mainAccessToken },
      ...additionalAccounts.map((a) => ({ email: a.email, accessToken: a.accessToken, account: a })),
    ];

    const seenEmails = new Set<string>();
    const uniqueTargets = allTargets.filter((t) => {
      if (seenEmails.has(t.email)) return false;
      seenEmails.add(t.email);
      return true;
    });

    // Drive準備
    const appFolderId = await ensureAppFolder(mainAccessToken);
    const receiptsFolderId = await ensureSubFolder(mainAccessToken, appFolderId, "receipts");

    // 日付クエリ
    const date = new Date(Date.now() - daysAgo * 86400000);
    const afterStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

    const allRows: ImportRow[] = [];
    const seenHashes = new Set<string>();
    let totalProcessed = 0;
    const updatedAccounts = [...(settings.gmailAccounts || [])];
    let needsAccountUpdate = false;

    // === 各アカウントで検索 ===
    for (const target of uniqueTargets) {
      let activeToken = target.accessToken;

      // 追加アカウントなら token のリフレッシュ確認
      if (target.account) {
        try {
          const { accessToken: refreshed, updatedAccount } = await ensureValidAccessToken(target.account);
          activeToken = refreshed;
          if (updatedAccount.accessToken !== target.account.accessToken) {
            // 更新あり
            const idx = updatedAccounts.findIndex((a) => a.id === updatedAccount.id);
            if (idx >= 0) {
              updatedAccounts[idx] = updatedAccount;
              needsAccountUpdate = true;
            }
          }
        } catch (e) {
          console.error("Token refresh failed for " + target.email, e);
          continue; // このアカウントはスキップ
        }
      }

      // ホワイトリストエントリごとに検索
      for (const entry of enabledWhitelist) {
        let query = `after:${afterStr}`;
        if (entry.matchType === "from") {
          query += ` from:${entry.matchValue}`;
        } else {
          query += ` subject:"${entry.matchValue}"`;
        }

        let messages: { id: string }[] = [];
        try {
          messages = await listMessages(activeToken, query, 50);
        } catch (e) {
          console.error(`検索失敗(${target.email}/${entry.name}):`, e);
          continue;
        }

        for (const m of messages) {
          try {
            const message = await getMessage(activeToken, m.id);
            const subject = getHeader(message, "Subject");
            const from = getHeader(message, "From");
            const dateHeader = getHeader(message, "Date");
            const bodyText = extractBodyText(message);

            const extractResult = await extractWithClaude(
              apiKey, subject, from, bodyText, entry.name
            );
            totalProcessed++;

            if (!extractResult.isInvoice || !extractResult.amount) continue;

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

            // PDF添付保存
            let receiptUrl: string | undefined;
            const pdfs = extractPdfAttachments(message);
            if (pdfs.length > 0) {
              try {
                const pdf = pdfs[0];
                const attachment = await getAttachment(activeToken, m.id, pdf.attachmentId);
                const normalized = attachment.data.replace(/-/g, "+").replace(/_/g, "/");
                const binary = atob(normalized);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const fileName = `${txDate}_gmail_${m.id}.pdf`;
                receiptUrl = await uploadBinaryFile(
                  mainAccessToken, receiptsFolderId, fileName, bytes, "application/pdf"
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
              note: `[Gmail/${target.email}] ${subject.slice(0, 50)}`,
              receiptUrl,
              include: true,
              warning: receiptUrl ? undefined : "PDF添付なし(本文から抽出)",
            });
          } catch (e) {
            console.error(`メッセージ処理失敗(${m.id}):`, e);
          }
        }
      }
    }

    // アカウントの token 更新があれば保存
    if (needsAccountUpdate) {
      try {
        await saveSettings({
          businessTags: settings.businessTags,
          apportionRules: settings.apportionRules,
          accounts: settings.accounts,
          gmailWhitelist: settings.gmailWhitelist,
          bankAccount: settings.bankAccount,
          companyInfo: settings.companyInfo,
          gmailAccounts: updatedAccounts,
        });
      } catch (e) {
        console.error("Token更新保存失敗:", e);
      }
    }

    return { ok: true, rows: allRows, processedCount: totalProcessed };
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
    if (!response.ok) return { isInvoice: false, reason: "Claude API エラー" };
    const data = await response.json();
    const textBlock = data.content?.find((c: { type: string; text?: string }) => c.type === "text");
    if (!textBlock?.text) return { isInvoice: false, reason: "Claude応答が空" };
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { isInvoice: false, reason: "JSON抽出失敗" };
    return JSON.parse(jsonMatch[0]) as GmailExtractResult;
  } catch (e) {
    console.error("Claude API 呼び出しエラー:", e);
    return { isInvoice: false, reason: "API呼び出し失敗" };
  }
}
