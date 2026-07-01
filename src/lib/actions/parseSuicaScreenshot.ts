"use server";

import type { ImportRow } from "@/lib/types";
import { auth } from "@/auth";
import {
  ensureAppFolder,
  ensureSubFolder,
  uploadBinaryFile,
} from "@/lib/drive/client";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-haiku-4-5";

interface SuicaTransaction {
  date: string;
  type: "train" | "shop" | "exit";
  fromStation?: string;
  toStation?: string;
  amount: number;
}

function makeHash(date: string, amount: number, description: string): string {
  const src = date + "|" + amount + "|" + description;
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return "suica_" + Math.abs(hash).toString(36);
}

function normalizeDate(mmdd: string): string {
  const m = mmdd.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return mmdd;
  const [, mo, d] = m;
  const now = new Date();
  const candidate = new Date(now.getFullYear(), parseInt(mo) - 1, parseInt(d));
  let year = now.getFullYear();
  if (candidate.getTime() > now.getTime() + 86400000) {
    year = year - 1;
  }
  return year + "-" + mo.padStart(2, "0") + "-" + d.padStart(2, "0");
}

export async function parseSuicaScreenshot(
  imageBase64Array: { base64: string; mimeType: string }[]
): Promise<{ ok: true; rows: ImportRow[] } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY が設定されていません" };
  }

  const session = await auth();
  const accessToken = session?.accessToken;
  const screenshotFileIds: (string | undefined)[] = [];

  if (accessToken) {
    try {
      const appFolderId = await ensureAppFolder(accessToken);
      const receiptsFolderId = await ensureSubFolder(
        accessToken,
        appFolderId,
        "receipts"
      );

      for (let i = 0; i < imageBase64Array.length; i++) {
        const { base64, mimeType } = imageBase64Array[i];
        try {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10);
          let ext = "jpg";
          if (mimeType === "image/png") ext = "png";
          else if (mimeType === "image/webp") ext = "webp";
          const fileName = dateStr + "_suica_" + now.getTime() + "_" + i + "." + ext;

          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) {
            bytes[j] = binary.charCodeAt(j);
          }

          const fileId = await uploadBinaryFile(
            accessToken,
            receiptsFolderId,
            fileName,
            bytes,
            mimeType
          );
          screenshotFileIds.push(fileId);
        } catch (e) {
          console.error("Suicaスクショ保存エラー(取引抽出は続行):", e);
          screenshotFileIds.push(undefined);
        }
      }
    } catch (e) {
      console.error("Drive初期化エラー(取引抽出は続行):", e);
    }
  }

  const allRows: ImportRow[] = [];
  const seenHashes = new Set<string>();

  for (let imgIdx = 0; imgIdx < imageBase64Array.length; imgIdx++) {
    const { base64, mimeType } = imageBase64Array[imgIdx];

    const prompt = `この画像は日本のモバイルSuica利用履歴のスクリーンショットです。表示されている全ての取引を抽出してください。

利用履歴の形式:
- 月日: MM/DD 形式(例: "06/26")
- 種別: "入"と"出"のペア(電車利用)、"物販"(店舗利用)、"窓出"(窓口出場)
- 利用場所: 駅名(電車の場合) or 空欄(物販の場合)
- 残高/差額: 残高(¥XXX)と差額(-XXX)

抽出ルール:
1. "入"と"出"のペアは1つの電車取引として扱う(fromStation=入の場所、toStation=出の場所)
2. "物販"は1つの取引として扱う(typeは"shop")
3. "窓出"はexit扱い(基本的に差額0でスキップ可)
4. 残高ではなく差額(マイナス値)から金額を抽出(絶対値で正の数として返す)
5. 各取引のtype: "train"(電車) / "shop"(物販) / "exit"(窓出)

以下のJSON形式のみで回答してください。説明文は不要です:
{
  "transactions": [
    {
      "date": "06/26",
      "type": "train",
      "fromStation": "上北沢",
      "toStation": "幡ヶ谷",
      "amount": 160
    }
  ]
}`;

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
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: base64,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Claude API error:", errText);
        return { ok: false, error: "Claude API エラー(画像 " + (imgIdx + 1) + "): " + response.status };
      }

      const data = await response.json();
      const textBlock = data.content?.find((c: { type: string; text?: string }) => c.type === "text");
      if (!textBlock?.text) {
        return { ok: false, error: "Claude応答が空(画像 " + (imgIdx + 1) + ")" };
      }

      let jsonText = textBlock.text.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { ok: false, error: "JSON抽出失敗(画像 " + (imgIdx + 1) + ")" };
      }
      jsonText = jsonMatch[0];

      const parsed = JSON.parse(jsonText) as { transactions: SuicaTransaction[] };

      for (const tx of parsed.transactions) {
        if (tx.amount === 0 || tx.type === "exit") continue;

        let description = "";
        if (tx.type === "train") {
          const from = tx.fromStation || "?";
          const to = tx.toStation || "?";
          description = from + " → " + to;
        } else if (tx.type === "shop") {
          description = "Suica物販";
        } else {
          description = "Suica利用";
        }

        const date = normalizeDate(tx.date);
        const hash = makeHash(date, tx.amount, description);

        if (seenHashes.has(hash)) continue;
        seenHashes.add(hash);

        allRows.push({
          rawHash: hash,
          rawDate: tx.date,
          rawDescription: description,
          rawAmount: tx.amount,
          date,
          description,
          amount: tx.amount,
          type: "expense",
          category: "private_drawing",
          accountCode: "transportation",
          tagIds: [],
          paymentMethod: "Suica",
          note: undefined,
          receiptUrl: screenshotFileIds[imgIdx],
          include: false,
          warning: "事業利用なら個別に確認・分類してください",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "不明なエラー";
      return { ok: false, error: "画像 " + (imgIdx + 1) + " の処理失敗: " + msg };
    }
  }

  return { ok: true, rows: allRows };
}
