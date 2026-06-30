// 個人事業主向け勘定科目マスタ
// 確定申告書(青色申告決算書)に対応した勘定科目

import type { AccountDef } from "@/lib/types";

export const JOURNAL_ACCOUNTS: AccountDef[] = [
  // ==================== 資産 (Asset) ====================
  // 流動資産
  { code: "cash", name: "現金", category: "asset", subCategory: "流動資産", tax_form_line: "BS_cash" },
  { code: "bank_ufj", name: "普通預金(三菱UFJ)", category: "asset", subCategory: "流動資産", tax_form_line: "BS_bank" },
  { code: "accounts_receivable", name: "売掛金", category: "asset", subCategory: "流動資産", tax_form_line: "BS_receivable" },
  { code: "emoney_paypay", name: "PayPay", category: "asset", subCategory: "流動資産", tax_form_line: "BS_emoney" },
  { code: "emoney_suica", name: "Suica", category: "asset", subCategory: "流動資産", tax_form_line: "BS_emoney" },
  { code: "emoney_hachipay", name: "ハチペイ", category: "asset", subCategory: "流動資産", tax_form_line: "BS_emoney" },

  // 固定資産
  { code: "fixed_asset", name: "工具器具備品", category: "asset", subCategory: "固定資産", tax_form_line: "BS_fixed" },
  { code: "deferred_startup", name: "開業費", category: "asset", subCategory: "繰延資産", tax_form_line: "BS_deferred" },

  // ==================== 負債 (Liability) ====================
  { code: "accounts_payable", name: "買掛金", category: "liability", subCategory: "流動負債", tax_form_line: "BS_payable" },
  { code: "unpaid_nicos", name: "未払金(ニコス)", category: "liability", subCategory: "流動負債", tax_form_line: "BS_unpaid" },
  { code: "unpaid_heart_one", name: "未払金(Heart One)", category: "liability", subCategory: "流動負債", tax_form_line: "BS_unpaid" },
  { code: "unpaid_other", name: "未払金(その他)", category: "liability", subCategory: "流動負債", tax_form_line: "BS_unpaid" },
  { code: "deposit_received", name: "預り金(源泉徴収)", category: "liability", subCategory: "流動負債", tax_form_line: "BS_deposit" },

  // ==================== 純資産 (Equity) ====================
  { code: "owner_capital", name: "元入金", category: "equity", tax_form_line: "BS_capital" },
  { code: "owner_drawings", name: "事業主貸", category: "equity", tax_form_line: "BS_drawings" },
  { code: "owner_loan", name: "事業主借", category: "equity", tax_form_line: "BS_loan" },

  // ==================== 収益 (Revenue) ====================
  { code: "sales", name: "売上高", category: "revenue", subCategory: "売上", tax_form_line: "PL_sales" },
  { code: "other_income", name: "雑収入", category: "revenue", subCategory: "営業外収益", tax_form_line: "PL_other_income" },

  // ==================== 費用 (Expense) ====================
  // 販売費及び一般管理費
  { code: "rent", name: "地代家賃", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_rent" },
  { code: "utilities", name: "水道光熱費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_utilities" },
  { code: "communication", name: "通信費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_communication" },
  { code: "transportation", name: "旅費交通費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_transport" },
  { code: "entertainment", name: "接待交際費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_entertainment" },
  { code: "supplies", name: "消耗品費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_supplies" },
  { code: "ad_marketing", name: "広告宣伝費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_ad" },
  { code: "book_education", name: "新聞図書費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_book" },
  { code: "outsourcing", name: "外注工賃", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_outsourcing" },
  { code: "tax_public", name: "租税公課", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_tax" },
  { code: "insurance", name: "損害保険料", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_insurance" },
  { code: "repair", name: "修繕費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_repair" },
  { code: "freight", name: "荷造運賃", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_freight" },
  { code: "welfare", name: "福利厚生費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_welfare" },
  { code: "depreciation", name: "減価償却費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_depreciation" },
  { code: "fee_dues", name: "諸会費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_dues" },
  { code: "misc", name: "雑費", category: "expense", subCategory: "販売費及び一般管理費", tax_form_line: "PL_misc" },
];

export function getAccountByCode(code: string): AccountDef | undefined {
  return JOURNAL_ACCOUNTS.find((a) => a.code === code);
}

export function getAccountsByCategory(category: AccountDef["category"]): AccountDef[] {
  return JOURNAL_ACCOUNTS.filter((a) => a.category === category);
}
