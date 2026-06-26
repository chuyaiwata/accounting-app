// =============================================================================
// 会計アプリ データモデル(最終版)
// =============================================================================
// 個人事業主・青色申告(65万円控除)・免税事業者を前提とした型定義
// 立替金・事業主貸借・所得控除・固定資産・キャッシュフロー管理に対応
// =============================================================================

// -----------------------------------------------------------------------------
// 基本型
// -----------------------------------------------------------------------------

export type DateString = string;
export type Timestamp = string;
export type ID = string;

// -----------------------------------------------------------------------------
// 勘定科目 (Account)
// -----------------------------------------------------------------------------

export type AccountCategory =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense';

export interface Account {
  id: ID;
  code: string;
  nameJa: string;
  category: AccountCategory;
  defaultTaxRate: number;
  isAllocatable: boolean;
}

// -----------------------------------------------------------------------------
// 事業タグ (Tag)
// -----------------------------------------------------------------------------

export interface Tag {
  id: ID;
  name: string;
  color: string;
}

// -----------------------------------------------------------------------------
// 取引先 (Counterparty)
// -----------------------------------------------------------------------------

export type CounterpartyType =
  | 'individual'
  | 'tax_exempt'
  | 'taxable_with_t'
  | 'taxable_no_t';

export interface Counterparty {
  id: ID;
  name: string;
  type: CounterpartyType;
  email?: string;
  address?: string;
  tNumber?: string;
  withholdingDefault: boolean;
  note?: string;
  createdAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 取引カテゴリ - 取引の性質を分類
// -----------------------------------------------------------------------------

export type TransactionCategory =
  | 'business'              // 通常の事業取引(売上/経費)
  | 'reimbursable'          // 立替金(損益に影響しない)
  | 'private_drawing'       // 事業主貸(個人支払いを事業から)
  | 'private_contribution'  // 事業主借(個人資金を事業へ)
  | 'tax_deductible'        // 所得控除対象(国保・年金等)
  | 'fixed_asset'           // 固定資産購入
  | 'prepaid'               // 前受金/前払金
  | 'inventory'             // 棚卸資産(在庫)
  | 'loan';                 // 借入金

// -----------------------------------------------------------------------------
// 所得控除のサブカテゴリ
// -----------------------------------------------------------------------------

export type TaxDeductionType =
  | 'health_insurance'       // 国民健康保険料(社会保険料控除)
  | 'national_pension'       // 国民年金保険料(社会保険料控除)
  | 'small_business_mutual'  // 小規模企業共済等掛金控除(iDeCo含む)
  | 'life_insurance'         // 生命保険料控除
  | 'earthquake_insurance'   // 地震保険料控除
  | 'medical_expense'        // 医療費控除
  | 'donation'               // 寄附金控除(ふるさと納税)
  | 'other';                 // その他

// -----------------------------------------------------------------------------
// 取引種別
// -----------------------------------------------------------------------------

export type TransactionType =
  | 'income'      // 収入
  | 'expense'     // 支出
  | 'transfer';   // 振替(立替金の回収など)

// -----------------------------------------------------------------------------
// 取引の発生元
// -----------------------------------------------------------------------------

export type TransactionSource =
  | 'manual'
  | 'ocr'
  | 'gmail'
  | 'csv'
  | 'invoice'
  | 'recurring';

// -----------------------------------------------------------------------------
// 取引のステータス(下書き/確定)
// -----------------------------------------------------------------------------

export type TransactionStatus =
  | 'draft'
  | 'confirmed';

// -----------------------------------------------------------------------------
// 決済状態 - キャッシュフロー管理用
// -----------------------------------------------------------------------------

export type SettlementStatus =
  | 'unpaid'    // 未払い / 未入金
  | 'partial'   // 一部決済
  | 'settled';  // 支払済み / 入金済み

// -----------------------------------------------------------------------------
// 取引 (Transaction) - すべての経済イベントの基本単位
// -----------------------------------------------------------------------------

export interface Transaction {
  id: ID;
  date: DateString;
  description: string;
  amount: number;

  // 分類
  category: TransactionCategory;
  type: TransactionType;
  source: TransactionSource;
  status: TransactionStatus;

  // 所得控除の場合のサブカテゴリ
  taxDeductionType?: TaxDeductionType;

  // 立替金の場合の関連情報
  reimbursableLinkId?: ID;

  // キャッシュフロー管理
  settlementStatus: SettlementStatus;
  expectedSettlementDate?: DateString;
  actualSettlementDate?: DateString;

  // 勘定科目(青色申告の損益計算書集計用)
  accountCode?: string;

  // 関連
  counterpartyId?: ID;
  receiptId?: ID;
  tagIds: ID[];
  fixedAssetId?: ID;

  // 詳細
  paymentMethod?: string;
  note?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 仕訳 (Journal Entry)
// -----------------------------------------------------------------------------

export interface JournalEntry {
  id: ID;
  transactionId: ID;
  accountId: ID;
  debit: number;
  credit: number;
  taxAmount: number;
  taxRate: number;
  allocationRatio: number;
}

// -----------------------------------------------------------------------------
// 証憑 (Receipt)
// -----------------------------------------------------------------------------

export interface Receipt {
  id: ID;
  driveFileId: string;
  fileType: 'image' | 'pdf';
  ocrText?: string;
  ocrConfidence?: number;
  uploadedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 家事按分ルール (Allocation Rule)
// -----------------------------------------------------------------------------

export interface AllocationRule {
  id: ID;
  accountId: ID;
  businessRatio: number;
  note?: string;
}

// -----------------------------------------------------------------------------
// 固定資産 (Fixed Asset)
// -----------------------------------------------------------------------------

export interface FixedAsset {
  id: ID;
  name: string;
  acquisitionDate: DateString;
  acquisitionCost: number;
  usefulLife: number;
  depreciationMethod: 'straight_line' | 'declining_balance';
  isLumpSum: boolean;
  businessRatio: number;
  disposalDate?: DateString;
  note?: string;
  tagIds: ID[];
  createdAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 在庫 (Inventory)
// -----------------------------------------------------------------------------

export interface InventoryItem {
  id: ID;
  name: string;
  unitCost: number;
  quantity: number;
  totalValue: number;
  asOfDate: DateString;
  tagIds: ID[];
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 借入金 (Loan)
// -----------------------------------------------------------------------------

export interface Loan {
  id: ID;
  lenderName: string;
  principal: number;
  interestRate: number;
  startDate: DateString;
  endDate: DateString;
  monthlyPayment: number;
  balance: number;
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 請求書 (Invoice)
// -----------------------------------------------------------------------------

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface InvoiceItem {
  id: ID;
  invoiceId: ID;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface Invoice {
  id: ID;
  invoiceNo: string;
  issueDate: DateString;
  dueDate: DateString;
  counterpartyId: ID;
  tagId?: ID;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  withholdingAmount: number;
  total: number;
  transferAmount: number;
  status: InvoiceStatus;
  pdfDriveFileId?: string;
  transactionId?: ID;
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// メール取込ルール (Email Rule)
// -----------------------------------------------------------------------------

export interface EmailRule {
  id: ID;
  name: string;
  senderPattern: string;
  subjectPattern: string;
  amountExtractRegex: string;
  accountId: ID;
  counterpartyId?: ID;
  defaultTagIds: ID[];
  allocationRatio: number;
  enabled: boolean;
}

// -----------------------------------------------------------------------------
// 定期取引ルール (Recurring Rule)
// -----------------------------------------------------------------------------

export interface RecurringRule {
  id: ID;
  name: string;
  dayOfMonth: number;
  type: TransactionType;
  category: TransactionCategory;
  taxDeductionType?: TaxDeductionType;
  accountId: ID;
  counterpartyId?: ID;
  amount: number;
  description: string;
  tagIds: ID[];
  allocationRatio: number;
  paymentMethod?: string;
  enabled: boolean;
}

//