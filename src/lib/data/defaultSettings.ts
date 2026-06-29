import type { AppSettings, BusinessTag, AccountMaster, GmailWhitelistEntry, BankAccountInfo, CompanyInfo } from "@/lib/types";

export const DEFAULT_BUSINESS_TAGS: BusinessTag[] = [
  { id: "pbs4", name: "PBS4", color: "#4f8bff" },
  { id: "upcycle", name: "アップサイクル", color: "#34d399" },
  { id: "event", name: "イベント", color: "#fbbf24" },
  { id: "common", name: "共通", color: "#7a7f8c" },
];

export const DEFAULT_ACCOUNTS: AccountMaster[] = [
  { id: "cash", name: "現金", kind: "cash" },
  { id: "ufj-bank", name: "三菱UFJ銀行", kind: "bank" },
  { id: "ufj-nicos", name: "三菱UFJニコス", kind: "card" },
  { id: "heart-one", name: "Heart One(家賃)", kind: "card" },
  { id: "paypay", name: "PayPay", kind: "emoney" },
  { id: "suica", name: "Suica", kind: "emoney" },
  { id: "hachi-pay", name: "ハチペイ", kind: "emoney" },
];


export const DEFAULT_GMAIL_WHITELIST: GmailWhitelistEntry[] = [
  // 公共料金
  { id: "gas-tokyo", name: "東京ガス", matchType: "from", matchValue: "tokyo-gas.co.jp", defaultAccountCode: "523", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },
  { id: "tepco", name: "東京電力", matchType: "from", matchValue: "tepco.co.jp", defaultAccountCode: "523", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },
  { id: "water-tokyo", name: "東京都水道局", matchType: "from", matchValue: "waterworks.metro.tokyo", defaultAccountCode: "523", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },

  // 通信
  { id: "softbank", name: "ソフトバンク", matchType: "from", matchValue: "softbank.jp", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },
  { id: "au-kddi", name: "au/KDDI", matchType: "from", matchValue: "kddi.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },
  { id: "airalo", name: "AIRALO", matchType: "from", matchValue: "airalo.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },

  // SaaS/サブスク
  { id: "apple", name: "Apple", matchType: "from", matchValue: "apple.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["pbs4"], enabled: true },
  { id: "adobe", name: "Adobe", matchType: "from", matchValue: "adobe.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["pbs4"], enabled: true },
  { id: "github", name: "GitHub", matchType: "from", matchValue: "github.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["pbs4"], enabled: true },
  { id: "vercel", name: "Vercel", matchType: "from", matchValue: "vercel.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["pbs4"], enabled: true },
  { id: "anthropic", name: "Anthropic/Claude", matchType: "from", matchValue: "anthropic.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["pbs4"], enabled: true },
  { id: "openai", name: "OpenAI", matchType: "from", matchValue: "openai.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["pbs4"], enabled: true },
  { id: "notion", name: "Notion", matchType: "from", matchValue: "notion.so", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },
  { id: "slack", name: "Slack", matchType: "from", matchValue: "slack.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },
  { id: "microsoft", name: "Microsoft", matchType: "from", matchValue: "microsoft.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },
  { id: "figma", name: "Figma", matchType: "from", matchValue: "figma.com", defaultAccountCode: "525", defaultCategory: "business", defaultTagIds: ["pbs4"], enabled: true },

  // 税・社会保険
  { id: "nenkin", name: "国民年金機構", matchType: "from", matchValue: "nenkin.go.jp", defaultCategory: "tax_deductible", defaultTagIds: [], enabled: true },
  { id: "ku-zei", name: "区民税", matchType: "subject", matchValue: "区民税", defaultCategory: "tax_deductible", defaultTagIds: [], enabled: true },
  { id: "to-zei", name: "都税", matchType: "subject", matchValue: "都税", defaultCategory: "tax_deductible", defaultTagIds: [], enabled: true },

  // 金融
  { id: "heart-one", name: "Heart One", matchType: "from", matchValue: "heart-one", defaultCategory: "business", defaultTagIds: [], enabled: true },
  { id: "ufj-nicos", name: "三菱UFJニコス", matchType: "from", matchValue: "cr.mufg.jp", defaultCategory: "business", defaultTagIds: [], enabled: true },

  // 不動産
  { id: "cosmos-initia", name: "コスモイニシア", matchType: "from", matchValue: "cosmos-initia", defaultAccountCode: "521", defaultCategory: "business", defaultTagIds: ["common"], enabled: true },

  // EC
  { id: "amazon", name: "Amazon", matchType: "from", matchValue: "amazon.co.jp", defaultAccountCode: "530", defaultCategory: "business", defaultTagIds: [], enabled: true },
  { id: "rakuten", name: "楽天", matchType: "from", matchValue: "rakuten.co.jp", defaultAccountCode: "530", defaultCategory: "business", defaultTagIds: [], enabled: true },
];


export const DEFAULT_BANK_ACCOUNT: BankAccountInfo = {
  bankName: "三菱UFJ銀行",
  branchName: "三軒茶屋支店",
  accountType: "ordinary",
  accountNumber: "3843219",
  accountHolder: "イワタ チユウヤ",
};


export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: "岩田 宙也",
  postalCode: "151-0062",
  address: "東京都渋谷区",
  phone: "080-3347-0303",
  email: "chuya.iwata@gmail.com",
};

export const DEFAULT_SETTINGS: AppSettings = {
  businessTags: DEFAULT_BUSINESS_TAGS,
  apportionRules: [],
  accounts: DEFAULT_ACCOUNTS,
  gmailWhitelist: DEFAULT_GMAIL_WHITELIST,
  bankAccount: DEFAULT_BANK_ACCOUNT,
  companyInfo: DEFAULT_COMPANY_INFO,
  updatedAt: new Date(0).toISOString(),
};
