/**
 * 全角→半角、先頭ゼロ削除、カンマ剥がし、数字以外除去
 * 空文字は 0 を返す
 */
export function sanitizeNumberInput(value: string): number {
  if (!value) return 0;
  let s = value;
  // 全角数字→半角(コードポイント 0xFF10-0xFF19 → 0x30-0x39)
  s = s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );
  // カンマ剥がし
  s = s.replace(/,/g, "");
  // 数字と小数点とマイナスのみ残す
  s = s.replace(/[^0-9.\-]/g, "");
  // 先頭ゼロ削除(小数の 0. はキープ)
  if (/^0[0-9]/.test(s)) s = s.replace(/^0+/, "");
  if (s === "" || s === "-" || s === ".") return 0;
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

/**
 * 金額を ¥1,234,567 形式に整形
 */
export function formatYen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

/**
 * カンマ区切り整形(¥記号なし)
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}
