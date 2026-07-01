"use server";

import Anthropic from "@anthropic-ai/sdk";

export interface ClaudeReceiptResult {
  ok: true;
  amount: number | null;
  date: string | null;
  storeName: string | null;
  accountCode: string | null;
  tagIds: string[];
  description: string | null;
  paymentMethodHint: string | null;
  note: string | null;
}

export interface ClaudeReceiptError {
  ok: false;
  error: string;
}

const SYSTEM_PROMPT = `あなたは日本の個人事業主向け会計アプリのレシート読取アシスタントです。
レシート画像から以下の情報を抽出し、必ず指定されたJSON形式のみで返答してください。

【抽出項目】
1. amount: 合計金額(数値のみ、税込)。読み取れない場合はnull。
2. date: 取引日(YYYY-MM-DD形式)。読み取れない場合はnull。
3. storeName: 店名・事業者名(レシート上部に書かれている店名)。読み取れない場合はnull。
4. accountCode: 勘定科目コード。以下から最も適切なものを1つ選ぶ:
   - "511": 仕入高(商品の仕入)
   - "freight": 荷造運賃(配送料、梱包資材)
   - "utilities": 水道光熱費(電気・ガス・水道)
   - "transportation": 旅費交通費(電車、タクシー、ガソリン、駐車場、宿泊費)
   - "communication": 通信費(携帯、ネット回線、郵便、宅配便)
   - "526": 広告宣伝費(チラシ、Web広告)
   - "527": 接待交際費(飲食、贈答品)
   - "529": 修繕費
   - "supplies": 消耗品費(文房具、PC周辺機器、日用品、Amazon等のEC、コンビニ、スーパー)
   - "532": 福利厚生費(個人事業主は基本使わない)
   - "534": 外注工賃
   - "536": 地代家賃
   - "entertainment": 会議費(カフェでの打ち合わせ、会議室代)
   - "book_education": 新聞図書費(書籍、新聞、雑誌、Kindle)
   - "543": 研修費(セミナー、講習会)
   - "544": 支払手数料(振込手数料、決済手数料)
   - "545": 車両費(車関連)
   - "misc": 雑費(他に当てはまらないもの)
   不明な場合はnull。
5. tagIds: 事業タグ(複数可)。以下から該当するもの:
   - "pbs4": PBS4(iOSアプリ開発、Apple Developer関連、開発関連書籍)
   - "upcycle": アップサイクル事業(3Dプリンタ、フィラメント、ピックルボール球関連)
   - "event": イベント運営(会場費、機材レンタル、撮影、配信、イベント関連)
   - "common": 共通(複数事業にまたがる、または特定事業に紐付かない)
   該当なしの場合は空配列 []。
6. description: 取引内容の短い説明(例: "スターバックス渋谷店", "Amazon - USBハブ", "東京メトロ")。
7. paymentMethodHint: レシートに支払方法が書かれていれば(例: "現金", "VISA", "PayPay", "Suica")。読み取れない場合はnull。
8. note: その他、税務上有用なメモ(品目の詳細、軽減税率の有無など)。不要ならnull。

【出力形式】
{
  "amount": 数値またはnull,
  "date": "YYYY-MM-DD"またはnull,
  "storeName": 文字列またはnull,
  "accountCode": "コード"またはnull,
  "tagIds": [文字列の配列],
  "description": 文字列またはnull,
  "paymentMethodHint": 文字列またはnull,
  "note": 文字列またはnull
}

JSONのみを返してください。説明文や前置きは一切不要です。`;

export async function parseReceiptWithClaude(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
): Promise<ClaudeReceiptResult | ClaudeReceiptError> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEYが設定されていません" };
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "このレシート画像から情報を抽出してJSONで返してください。",
            },
          ],
        },
      ],
    });

    // テキスト部分を抽出
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Claude APIからテキスト応答が得られませんでした" };
    }

    const text = textBlock.text.trim();

    // JSON抽出(マークダウンのコードブロックで囲まれている可能性に対応)
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);

    return {
      ok: true,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
      storeName: typeof parsed.storeName === "string" ? parsed.storeName : null,
      accountCode:
        typeof parsed.accountCode === "string" ? parsed.accountCode : null,
      tagIds: Array.isArray(parsed.tagIds)
        ? parsed.tagIds.filter((t: unknown) => typeof t === "string")
        : [],
      description:
        typeof parsed.description === "string" ? parsed.description : null,
      paymentMethodHint:
        typeof parsed.paymentMethodHint === "string"
          ? parsed.paymentMethodHint
          : null,
      note: typeof parsed.note === "string" ? parsed.note : null,
    };
  } catch (err) {
    console.error("Claude API error:", err);
    const message = err instanceof Error ? err.message : "不明なエラー";
    return { ok: false, error: `Claude API呼び出しに失敗: ${message}` };
  }
}
