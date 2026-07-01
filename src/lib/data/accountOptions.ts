/**
 * AddTransactionFormで使う勘定科目の選択肢
 * - カテゴリ別にグルーピング
 * - よく使う順に並べる
 */

export interface AccountOption {
  code: string;
  label: string;
}

export interface AccountGroup {
  label: string;
  options: AccountOption[];
}

// 経費系(支出で使う)
export const EXPENSE_ACCOUNTS: AccountGroup[] = [
  {
    label: "よく使う",
    options: [
      { code: "supplies", label: "消耗品費" },
      { code: "transportation", label: "旅費交通費" },
      { code: "communication", label: "通信費" },
      { code: "entertainment", label: "会議費" },
      { code: "527", label: "接待交際費" },
      { code: "book_education", label: "新聞図書費" },
      { code: "utilities", label: "水道光熱費" },
      { code: "544", label: "支払手数料" },
    ],
  },
  {
    label: "その他",
    options: [
      { code: "511", label: "仕入高" },
      { code: "tax_public", label: "租税公課" },
      { code: "freight", label: "荷造運賃" },
      { code: "526", label: "広告宣伝費" },
      { code: "528", label: "損害保険料" },
      { code: "529", label: "修繕費" },
      { code: "531", label: "減価償却費" },
      { code: "534", label: "外注工賃" },
      { code: "535", label: "利子割引料" },
      { code: "536", label: "地代家賃" },
      { code: "543", label: "研修費" },
      { code: "545", label: "車両費" },
      { code: "misc", label: "雑費" },
    ],
  },
];

// 収入系(収入で使う)
export const INCOME_ACCOUNTS: AccountOption[] = [
  { code: "411", label: "売上高" },
  { code: "421", label: "雑収入" },
];

// 全費用科目のフラットリスト(コード → ラベルの逆引き用)
export const ALL_ACCOUNT_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  EXPENSE_ACCOUNTS.forEach((g) =>
    g.options.forEach((o) => {
      map[o.code] = o.label;
    })
  );
  INCOME_ACCOUNTS.forEach((o) => {
    map[o.code] = o.label;
  });
  return map;
})();
