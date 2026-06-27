import type { ImportRow, TransactionCategory } from "@/lib/types";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

// "2026年5月13日" → "2026-05-13"
function normalizeJpDate(raw: string): string {
  const m = raw.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!m) return raw;
  const [, y, mo, d] = m;
  return y + "-" + mo.padStart(2, "0") + "-" + d.padStart(2, "0");
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s"円￥]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function makeHash(date: string, amount: number, description: string): string {
  const src = date + "|" + amount + "|" + description;
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return "nicos_" + Math.abs(hash).toString(36);
}

// 店名のヒューリスティック分類(基本版、後で辞書を充実)
function classifyNicos(storeName: string): {
  category: TransactionCategory;
  accountCode?: string;
  include: boolean;
  warning?: string;
} {
  const n = storeName;

  // 公共料金: 水道光熱費
  if (/東京ガス|東京電力|東京都水道|ENEOS|大阪ガス|関西電力/.test(n)) {
    return { category: "business", accountCode: "523", include: true, warning: "家事按分を確認してください" };
  }

  // 通信費
  if (/SoftBank|ソフトバンク|ＳｏｆｔＢａｎｋ|KDDI|au電話|ａｕ電話|NTT|ドコモ|楽天モバイル|AIRALO|VPN/i.test(n)) {
    return { category: "business", accountCode: "525", include: true };
  }

  // 国保・年金
  if (/国民年金|国民健康保険|健康保険料/.test(n)) {
    return { category: "tax_deductible", include: true };
  }

  // サブスク・SaaS(事業の可能性高)
  if (/APPLE|ADOBE|GITHUB|VERCEL|CLAUDE|OPENAI|FIGMA|NOTION|SLACK|GOOGLE|MICROSOFT/i.test(n)) {
    return { category: "business", accountCode: "525", include: true };
  }

  // 飲食店(プライベートの可能性高)
  if (/スキヤ|スキヤキ|マツヤ|ヨシノヤ|ハコネソバ|スターバックス|スタバ|ドトール|タリーズ|サイゼリヤ|ガスト|ジョナサン|箱根そば|モスバーガー|マクドナルド|サブウェイ/.test(n)) {
    return { category: "business", accountCode: "541", include: false, warning: "飲食(プライベート/会議費を要確認)" };
  }

  // コンビニ・スーパー(プライベート多め)
  if (/セブン−イレブン|セブンイレブン|ローソン|ファミリーマート|ファミマ|まいばすけっと|イオン|西友|ライフ|マルエツ|サミット/.test(n)) {
    return { category: "business", accountCode: "530", include: false, warning: "コンビニ・スーパー(プライベート率高)" };
  }

  // 医療費(所得控除)
  if (/クリニツ|クリニック|病院|薬局|ドラツグ|ドラッグ|ファーマシー|処方/.test(n)) {
    return { category: "tax_deductible", include: false, warning: "医療費控除の可能性あり" };
  }

  // Kindle・電子書籍
  if (/Kindle|キンドル|楽天Kobo|honto/i.test(n)) {
    return { category: "business", accountCode: "542", include: true, warning: "新聞図書費(事業用か確認)" };
  }

  // EC: 仕入か消耗品費
  if (/AMAZON|アマゾン|楽天市場|ヨドバシ|ビックカメラ|ヨドバシカメラ/.test(n)) {
    return { category: "business", accountCode: "530", include: false, warning: "EC利用(用途を確認)" };
  }

  // JR・電車・交通
  if (/JR東日本|JR西日本|東京メトロ|都営|京王|小田急|東急|京急|ハチペイ/.test(n)) {
    return { category: "business", accountCode: "524", include: false, warning: "交通系(事業使用か要確認)" };
  }

  // 電子マネーチャージ(プライベート振替の可能性高)
  if (/ハチペイ|PayPay　チャージ|Suica　チャージ/.test(n)) {
    return { category: "private_drawing", include: false, warning: "電子マネーチャージ(プライベート可能性高)" };
  }

  // デフォルト
  return { category: "business", include: false, warning: "用途を確認してください" };
}

export function parseUfjNicosCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 3) return [];

  const header = parseCsvLine(lines[0]);
  const payDateIdx = header.findIndex((h) => h.includes("お支払日"));
  const storeIdx = header.findIndex((h) => h.includes("ご利用店名"));
  const useDateIdx = header.findIndex((h) => h.includes("ご利用日"));
  const amountIdx = header.findIndex((h) => h.includes("ご利用金額"));

  if (payDateIdx === -1 || storeIdx === -1 || useDateIdx === -1 || amountIdx === -1) {
    throw new Error("UFJニコスのCSVフォーマットではありません");
  }

  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 7) continue;

    const useDate = cols[useDateIdx];
    const store = cols[storeIdx];
    const amountStr = cols[amountIdx];

    // 名義行(【岩田 宙也 様】等)はスキップ
    if (!useDate || !store || store.startsWith("【")) continue;

    const amount = parseAmount(amountStr);
    if (amount === 0) continue;

    const date = normalizeJpDate(useDate);
    const payDate = normalizeJpDate(cols[payDateIdx]);
    const description = store.replace(/\s+/g, " ").trim();
    const hash = makeHash(date, amount, description);

    const cls = classifyNicos(description);

    rows.push({
      rawHash: hash,
      rawDate: useDate,
      rawDescription: description,
      rawAmount: amount,
      date,
      description,
      amount,
      expectedSettlementDate: payDate,
      type: "expense",
      category: cls.category,
      accountCode: cls.accountCode,
      tagIds: [],
      paymentMethod: "三菱UFJニコス",
      note: undefined,
      include: cls.include,
      warning: cls.warning,
    });
  }

  return rows;
}
