import type { ImportRow, ImportSource } from "@/lib/types";

// CSVの1行を分解(クォート対応の簡易版)
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

// 日付YYYY/M/D → YYYY-MM-DD
function normalizeDate(raw: string): string {
  const m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return raw;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// 文字列の金額 "1,234" → 1234
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s"]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

// 簡易ハッシュ(重複検知用)
function makeHash(date: string, amount: number, description: string): string {
  const src = `${date}|${amount}|${description}`;
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return `ufj_${Math.abs(hash).toString(36)}`;
}

// 取引の自動分類ヒューリスティック
function classifyTransaction(
  rawDescription: string,
  isIncome: boolean
): {
  type: "income" | "expense";
  category: "business" | "private_drawing" | "private_contribution";
  include: boolean;
  accountCode?: string;
  warning?: string;
} {
  const desc = rawDescription;

  // 「カ）xxx」「カ ）xxx」「（カ）xxx」など株式会社からの振込
  const isCorporate = /^[(（]?(カ|ｶ|株)/.test(desc) || /[株K\(（]/.test(desc);

  // 自分の名前(イワタ)が含まれる→事業主貸/借
  const isSelf = /(イワタ|岩田|ＩＷＡＴＡ|IWATA)/i.test(desc);

  if (isSelf) {
    // 自分宛 → プライベート扱いでデフォルト除外
    return {
      type: isIncome ? "income" : "expense",
      category: isIncome ? "private_contribution" : "private_drawing",
      include: false,
      warning: "プライベート(自己振替)と推測されます",
    };
  }

  if (isIncome && isCorporate) {
    // 法人からの入金 → 売上
    return {
      type: "income",
      category: "business",
      include: true,
      accountCode: "411", // 売上高
    };
  }

  if (isIncome) {
    // 個人からの入金 → 売上候補だが警告
    return {
      type: "income",
      category: "business",
      include: true,
      accountCode: "411",
      warning: "個人名の入金です。売上か立替金回収かを確認してください",
    };
  }

  // 支払い側
  return {
    type: "expense",
    category: "business",
    include: false,
    warning: "支払い内容を確認してください",
  };
}

export function parseUfjBankCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  // ヘッダー行をスキップ(1行目)
  const header = parseCsvLine(lines[0]);
  // 期待: 日付,摘要,摘要内容,支払い金額,預かり金額,差引残高
  const dateIdx = header.findIndex((h) => h.includes("日付"));
  const summaryIdx = header.findIndex((h) => h === "摘要");
  const detailIdx = header.findIndex((h) => h.includes("摘要内容"));
  const payIdx = header.findIndex((h) => h.includes("支払"));
  const recvIdx = header.findIndex((h) => h.includes("預かり"));

  if (dateIdx === -1 || payIdx === -1 || recvIdx === -1) {
    throw new Error("UFJ銀行のCSVフォーマットではありません");
  }

  const rows: ImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 5) continue;

    const rawDate = cols[dateIdx];
    const summary = cols[summaryIdx] || "";
    const detail = cols[detailIdx] || "";
    const payAmount = parseAmount(cols[payIdx]);
    const recvAmount = parseAmount(cols[recvIdx]);

    const isIncome = recvAmount > 0;
    const amount = isIncome ? recvAmount : payAmount;
    if (amount === 0) continue;

    const date = normalizeDate(rawDate);
    const rawDescription = detail || summary;
    const description = rawDescription.replace(/\s+/g, " ").trim();
    const hash = makeHash(date, amount, rawDescription);

    const cls = classifyTransaction(rawDescription, isIncome);

    rows.push({
      rawHash: hash,
      rawDate,
      rawDescription,
      rawAmount: amount,
      date,
      description,
      amount,
      type: cls.type,
      category: cls.category,
      accountCode: cls.accountCode,
      tagIds: [],
      paymentMethod: "三菱UFJ銀行",
      note: summary && detail ? `[${summary}]` : undefined,
      include: cls.include,
      warning: cls.warning,
    });
  }

  return rows;
}

export const UFJ_BANK_SOURCE: ImportSource = "ufj_bank";
