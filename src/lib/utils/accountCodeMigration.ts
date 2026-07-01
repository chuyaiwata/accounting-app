// 旧勘定科目コード(3桁数字) → 新コード(英語ID) マッピング
// Drive上の既存データを読み込み時に自動変換するための互換レイヤ
export const OLD_TO_NEW_ACCOUNT_CODE: Record<string, string> = {
  "521": "tax_public",
  "522": "freight",
  "523": "utilities",
  "524": "transportation",
  "525": "communication",
  "530": "supplies",
  "541": "entertainment",
  "542": "book_education",
  "599": "misc",
};

export function migrateAccountCode(code: string | undefined | null): string | undefined {
  if (!code) return code ?? undefined;
  return OLD_TO_NEW_ACCOUNT_CODE[code] ?? code;
}
