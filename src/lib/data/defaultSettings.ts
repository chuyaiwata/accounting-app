import type { AppSettings, BusinessTag, AccountMaster } from "@/lib/types";

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

export const DEFAULT_SETTINGS: AppSettings = {
  businessTags: DEFAULT_BUSINESS_TAGS,
  apportionRules: [],
  accounts: DEFAULT_ACCOUNTS,
  updatedAt: new Date(0).toISOString(),
};
