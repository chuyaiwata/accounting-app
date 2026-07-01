// =============================================================================
// 標準勘定科目マスタ
// =============================================================================
// 個人事業主・青色申告で一般的に使われる科目セット
// 後から追加・編集可能。Chuyaさんの3事業に必要なものを優先的に含めている
// =============================================================================

import type { Account } from '@/lib/types';

export const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  // ---------------------------------------------------------------------------
  // 資産 (Asset)
  // ---------------------------------------------------------------------------
  { code: '111', nameJa: '現金',           category: 'asset',   defaultTaxRate: 0,    isAllocatable: false },
  { code: '112', nameJa: '普通預金',       category: 'asset',   defaultTaxRate: 0,    isAllocatable: false },
  { code: '113', nameJa: '事業用カード',   category: 'asset',   defaultTaxRate: 0,    isAllocatable: false },
  { code: '121', nameJa: '売掛金',         category: 'asset',   defaultTaxRate: 0,    isAllocatable: false },
  { code: '125', nameJa: '前払金',         category: 'asset',   defaultTaxRate: 0,    isAllocatable: false },
  { code: '131', nameJa: '商品',           category: 'asset',   defaultTaxRate: 0,    isAllocatable: false },
  { code: '132', nameJa: '原材料',         category: 'asset',   defaultTaxRate: 0,    isAllocatable: false },
  { code: '161', nameJa: '工具器具備品',   category: 'asset',   defaultTaxRate: 0.10, isAllocatable: false },
  { code: '162', nameJa: '車両運搬具',     category: 'asset',   defaultTaxRate: 0.10, isAllocatable: true  },

  // ---------------------------------------------------------------------------
  // 負債 (Liability)
  // ---------------------------------------------------------------------------
  { code: '211', nameJa: '買掛金',         category: 'liability', defaultTaxRate: 0,  isAllocatable: false },
  { code: '212', nameJa: '未払金',         category: 'liability', defaultTaxRate: 0,  isAllocatable: false },
  { code: '215', nameJa: '預り金',         category: 'liability', defaultTaxRate: 0,  isAllocatable: false },

  // ---------------------------------------------------------------------------
  // 純資産 (Equity)
  // ---------------------------------------------------------------------------
  { code: '311', nameJa: '元入金',         category: 'equity',  defaultTaxRate: 0,    isAllocatable: false },
  { code: '321', nameJa: '事業主貸',       category: 'equity',  defaultTaxRate: 0,    isAllocatable: false },
  { code: '322', nameJa: '事業主借',       category: 'equity',  defaultTaxRate: 0,    isAllocatable: false },

  // ---------------------------------------------------------------------------
  // 収益 (Revenue)
  // ---------------------------------------------------------------------------
  { code: '411', nameJa: '売上高',         category: 'revenue', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '421', nameJa: '雑収入',         category: 'revenue', defaultTaxRate: 0.10, isAllocatable: false },

  // ---------------------------------------------------------------------------
  // 費用 (Expense) — 標準科目
  // ---------------------------------------------------------------------------
  { code: '511', nameJa: '仕入高',         category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: 'tax_public', nameJa: '租税公課',       category: 'expense', defaultTaxRate: 0,    isAllocatable: false },
  { code: 'freight', nameJa: '荷造運賃',       category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: 'utilities', nameJa: '水道光熱費',     category: 'expense', defaultTaxRate: 0.10, isAllocatable: true  },
  { code: 'transportation', nameJa: '旅費交通費',     category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: 'communication', nameJa: '通信費',         category: 'expense', defaultTaxRate: 0.10, isAllocatable: true  },
  { code: '526', nameJa: '広告宣伝費',     category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '527', nameJa: '接待交際費',     category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '528', nameJa: '損害保険料',     category: 'expense', defaultTaxRate: 0,    isAllocatable: true  },
  { code: '529', nameJa: '修繕費',         category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: 'supplies', nameJa: '消耗品費',       category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '531', nameJa: '減価償却費',     category: 'expense', defaultTaxRate: 0,    isAllocatable: false },
  { code: '532', nameJa: '福利厚生費',     category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '533', nameJa: '給料賃金',       category: 'expense', defaultTaxRate: 0,    isAllocatable: false },
  { code: '534', nameJa: '外注工賃',       category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '535', nameJa: '利子割引料',     category: 'expense', defaultTaxRate: 0,    isAllocatable: false },
  { code: '536', nameJa: '地代家賃',       category: 'expense', defaultTaxRate: 0,    isAllocatable: true  },
  { code: '537', nameJa: '貸倒金',         category: 'expense', defaultTaxRate: 0,    isAllocatable: false },
  { code: 'entertainment', nameJa: '会議費',         category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: 'book_education', nameJa: '新聞図書費',     category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '543', nameJa: '研修費',         category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '544', nameJa: '支払手数料',     category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
  { code: '545', nameJa: '車両費',         category: 'expense', defaultTaxRate: 0.10, isAllocatable: true  },
  { code: 'misc', nameJa: '雑費',           category: 'expense', defaultTaxRate: 0.10, isAllocatable: false },
];