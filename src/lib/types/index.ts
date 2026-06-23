// =============================================================================
// 会計アプリ データモデル
// =============================================================================
// 個人事業主・青色申告(65万円控除)・免税事業者を前提とした型定義
// =============================================================================

// -----------------------------------------------------------------------------
// 基本型
// -----------------------------------------------------------------------------

/** ISO 8601形式の日付文字列 (例: "2026-06-23") */
export type DateString = string;

/** ISO 8601形式のタイムスタンプ (例: "2026-06-23T10:30:00Z") */
export type Timestamp = string;

/** UUID v4 形式の文字列 */
export type ID = string;

// -----------------------------------------------------------------------------
// 勘定科目 (Account)
// -----------------------------------------------------------------------------

/** 勘定科目のカテゴリ(複式簿記における5要素) */
export type AccountCategory =
  | 'asset'       // 資産 (現金、売掛金、固定資産など)
  | 'liability'   // 負債 (未払金、借入金など)
  | 'equity'      // 純資産 (元入金、事業主借、事業主貸)
  | 'revenue'     // 収益 (売上高など)
  | 'expense';    // 費用 (経費科目すべて)

/** 勘定科目 */
export interface Account {
  id: ID;
  code: string;           // 科目コード(例: "111" = 現金)
  nameJa: string;         // 日本語名(例: "現金")
  category: AccountCategory;
  defaultTaxRate: number; // 標準消費税率 (0, 0.08, 0.10)
  isAllocatable: boolean; // 家事按分の対象か
}

// -----------------------------------------------------------------------------
// 事業タグ (Tag)
// -----------------------------------------------------------------------------

/** 事業タグ - 1取引に複数付与可能 */
export interface Tag {
  id: ID;
  name: string;   // 例: "PBS4", "アップサイクル", "イベント", "共通"
  color: string;  // 例: "#7F77DD"
}

// -----------------------------------------------------------------------------
// 取引先 (Counterparty)
// -----------------------------------------------------------------------------

/** 取引先の種別(インボイス制度の経過措置判定に使用) */
export type CounterpartyType =
  | 'individual'        // 個人
  | 'tax_exempt'        // 免税事業者
  | 'taxable_with_t'    // 課税事業者(適格請求書発行事業者)
  | 'taxable_no_t';     // 課税事業者(適格請求書発行事業者でない)

/** 取引先マスタ */
export interface Counterparty {
  id: ID;
  name: string;
  type: CounterpartyType;
  email?: string;
  address?: string;
  tNumber?: string;           // 相手の適格請求書発行事業者番号 (T+13桁)
  withholdingDefault: boolean; // 源泉徴収の対象かのデフォルト値
  note?: string;
  createdAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 取引 (Transaction)
// -----------------------------------------------------------------------------

/** 取引の種別 */
export type TransactionType =
  | 'income'    // 収入
  | 'expense'   // 支出
  | 'transfer'; // 振替

/** 取引の発生元 */
export type TransactionSource =
  | 'manual'   // 手動入力
  | 'ocr'      // レシートOCR
  | 'gmail'    // Gmail取込
  | 'csv'      // 銀行/カードCSV
  | 'invoice'  // 請求書発行から自動生成
  | 'recurring'; // 定期取引ルールから自動生成

/** 取引のステータス */
export type TransactionStatus =
  | 'draft'      // 下書き(OCR後の確認待ちなど)
  | 'confirmed'; // 確定済み

/** 取引 - 1つの経済イベントを表す */
export interface Transaction {
  id: ID;
  date: DateString;
  description: string;
  amount: number;             // 税込総額
  type: TransactionType;
  source: TransactionSource;
  status: TransactionStatus;
  counterpartyId?: ID;
  receiptId?: ID;
  tagIds: ID[];               // 複数の事業タグを付与可能
  paymentMethod?: string;     // "現金", "三菱UFJ銀行", "三菱UFJニコス" など
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 仕訳 (Journal Entry)
// -----------------------------------------------------------------------------

/** 仕訳 - 複式簿記の借方/貸方の1行 */
export interface JournalEntry {
  id: ID;
  transactionId: ID;
  accountId: ID;
  debit: number;              // 借方金額
  credit: number;             // 貸方金額
  taxAmount: number;          // 消費税額
  taxRate: number;            // 消費税率 (0, 0.08, 0.10)
  allocationRatio: number;    // 家事按分の事業割合 (0.0〜1.0、1.0なら全額事業)
}

// -----------------------------------------------------------------------------
// 証憑 (Receipt)
// -----------------------------------------------------------------------------

/** 証憑(レシート画像・PDF等) */
export interface Receipt {
  id: ID;
  driveFileId: string;        // Google Drive上のファイルID
  fileType: 'image' | 'pdf';
  ocrText?: string;           // OCRで抽出した生テキスト
  ocrConfidence?: number;     // OCRの信頼度 (0.0〜1.0)
  uploadedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// 家事按分ルール (Allocation Rule)
// -----------------------------------------------------------------------------

/** 家事按分ルール - 科目ごとに事業/家事の比率を保持 */
export interface AllocationRule {
  id: ID;
  accountId: ID;
  businessRatio: number;      // 事業割合 (0.0〜1.0)
  note?: string;              // 例: "在宅勤務のため通信費の70%を事業として按分"
}

// -----------------------------------------------------------------------------
// 請求書 (Invoice)
// -----------------------------------------------------------------------------

/** 請求書のステータス */
export type InvoiceStatus =
  | 'draft'       // 下書き
  | 'sent'        // 送付済み
  | 'paid'        // 入金済み
  | 'overdue'     // 支払期限超過
  | 'cancelled';  // キャンセル

/** 請求書明細 */
export interface InvoiceItem {
  id: ID;
  invoiceId: ID;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

/** 請求書 */
export interface Invoice {
  id: ID;
  invoiceNo: string;          // 例: "INV-2026-008"
  issueDate: DateString;
  dueDate: DateString;
  counterpartyId: ID;
  tagId?: ID;                 // 事業タグ
  items: InvoiceItem[];
  subtotal: number;           // 税抜小計
  taxAmount: number;          // 消費税
  withholdingAmount: number;  // 源泉徴収税額
  total: number;              // 請求合計(税込)
  transferAmount: number;     // 実振込金額 (total - withholdingAmount)
  status: InvoiceStatus;
  pdfDriveFileId?: string;    // 発行したPDFのDrive ID
  transactionId?: ID;         // 発行時に生成された売掛金取引のID
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// -----------------------------------------------------------------------------
// メール取込ルール (Email Rule)
// -----------------------------------------------------------------------------

/** メール取込ルール - 請求書系メールを自動仕訳するための設定 */
export interface EmailRule {
  id: ID;
  name: string;               // 例: "SoftBank光 請求確定"
  senderPattern: string;      // 差出人のパターン
  subjectPattern: string;     // 件名のパターン
  amountExtractRegex: string; // 金額抽出用の正規表現
  accountId: ID;              // デフォルト科目
  counterpartyId?: ID;
  defaultTagIds: ID[];
  allocationRatio: number;
  enabled: boolean;
}

// -----------------------------------------------------------------------------
// 定期取引ルール (Recurring Rule)
// -----------------------------------------------------------------------------

/** 定期取引ルール - 毎月の家賃などを自動計上 */
export interface RecurringRule {
  id: ID;
  name: string;               // 例: "家賃(Heart One)"
  dayOfMonth: number;         // 毎月の発生日 (1〜31)
  type: TransactionType;
  accountId: ID;
  counterpartyId?: ID;
  amount: number;
  description: string;
  tagIds: ID[];
  allocationRatio: number;
  paymentMethod?: string;
  enabled: boolean;
}

// -----------------------------------------------------------------------------
// 設定 (Settings)
// -----------------------------------------------------------------------------

/** 事業者情報・申告設定 */
export interface BusinessSettings {
  ownerName: string;                  // 氏名
  tradeName?: string;                 // 屋号(任意)
  address: string;                    // 住所
  phone?: string;
  email: string;
  tNumber?: string;                   // 自身の適格請求書発行事業者番号
  tNumberRegisteredDate?: DateString; // T番号登録日(将来切替時)
  isTaxExempt: boolean;               // 免税事業者か
  fiscalYearStart: string;            // 会計年度開始月日 (例: "01-01")
  bankAccount: {
    bankName: string;
    branchName: string;
    accountType: '普通' | '当座';
    accountNumber: string;
    accountHolderName: string;
  };
}