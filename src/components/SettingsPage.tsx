"use client";

import { useState, useTransition } from "react";
import type {
  AppSettings,
  BusinessTag,
  ApportionRule,
  AccountMaster,
  AccountKind,
  GmailWhitelistEntry,
  BankAccountInfo,
} from "@/lib/types";
import { saveSettings } from "@/lib/actions/settings";
import { EXPENSE_ACCOUNTS } from "@/lib/data/accountOptions";
import { Tag as TagIcon, Percent, Wallet, Plus, Trash2, Loader2, Save, Mail, Edit2, Check, X } from "lucide-react";

interface Props {
  initialSettings: AppSettings;
}

type SectionKey = "tags" | "apportion" | "accounts" | "gmail";

const SECTIONS: { key: SectionKey; label: string; icon: typeof TagIcon }[] = [
  { key: "tags", label: "事業タグ", icon: TagIcon },
  { key: "apportion", label: "家事按分", icon: Percent },
  { key: "accounts", label: "口座マスタ", icon: Wallet },
  { key: "gmail", label: "Gmail取込", icon: Mail },
];

const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  bank: "銀行",
  card: "カード",
  emoney: "電子マネー",
  cash: "現金",
  other: "その他",
};

export default function SettingsPage({ initialSettings }: Props) {
  const [section, setSection] = useState<SectionKey>("tags");
  const [tags, setTags] = useState<BusinessTag[]>(initialSettings.businessTags);
  const [rules, setRules] = useState<ApportionRule[]>(initialSettings.apportionRules);
  const [accounts, setAccounts] = useState<AccountMaster[]>(initialSettings.accounts);
  const [gmailWhitelist, setGmailWhitelist] = useState<GmailWhitelistEntry[]>(initialSettings.gmailWhitelist || []);
  const [bankAccount, setBankAccount] = useState<BankAccountInfo | undefined>(initialSettings.bankAccount);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const handleSave = () => {
    setSaveStatus("idle");
    startTransition(async () => {
      const res = await saveSettings({
        businessTags: tags,
        apportionRules: rules,
        accounts,
        gmailWhitelist,
        bankAccount,
      });
      setSaveStatus(res.ok ? "saved" : "error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    });
  };

  return (
    <div className="px-4 md:px-10 py-6 md:py-8 max-w-[1400px]">
      {/* ヘッダー */}
      <div className="flex items-end justify-between mb-6 md:mb-8 flex-wrap gap-3">
        <div>
          <p className="text-[10px] md:text-xs text-[var(--text-tertiary)] mb-1 md:mb-2 tracking-wide uppercase">
            設定
          </p>
          <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight leading-none">
            マスタ管理
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
          style={{
            background:
              saveStatus === "saved"
                ? "#34d399"
                : saveStatus === "error"
                ? "#f87171"
                : "var(--accent)",
            color: "white",
          }}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveStatus === "saved"
            ? "保存しました"
            : saveStatus === "error"
            ? "保存失敗"
            : "保存"}
        </button>
      </div>

      {/* タブ切替 */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              style={{
                background: active ? "var(--bg-overlay)" : "transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* セクション本体 */}
      {section === "tags" && <TagsSection tags={tags} setTags={setTags} />}
      {section === "apportion" && (
        <ApportionSection rules={rules} setRules={setRules} />
      )}
      {section === "accounts" && (
        <AccountsSection accounts={accounts} setAccounts={setAccounts} />
      )}
      {section === "gmail" && (
        <GmailSection gmailWhitelist={gmailWhitelist} setGmailWhitelist={setGmailWhitelist} />
      )}
    </div>
  );
}

// =============== Tags Section ===============

function TagsSection({
  tags,
  setTags,
}: {
  tags: BusinessTag[];
  setTags: (t: BusinessTag[]) => void;
}) {
  const addTag = () => {
    const id = `tag-${Date.now().toString(36)}`;
    setTags([...tags, { id, name: "新規タグ", color: "#7a7f8c" }]);
  };

  const updateTag = (idx: number, patch: Partial<BusinessTag>) => {
    setTags(tags.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const removeTag = (idx: number) => {
    if (!confirm("このタグを削除しますか? 既存の取引のタグは保持されます。")) return;
    setTags(tags.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="rounded-xl p-4 md:p-6"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm md:text-base font-semibold mb-1">事業タグ</h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            3事業の按分や売上集計に使用
          </p>
        </div>
        <button
          onClick={addTag}
          className="px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1"
          style={{
            background: "var(--bg-overlay)",
            color: "var(--text-secondary)",
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          追加
        </button>
      </div>

      <div className="space-y-2">
        {tags.map((tag, idx) => (
          <div
            key={tag.id}
            className="flex items-center gap-2 p-2 rounded-lg min-w-0"
            style={{ background: "var(--bg-overlay)" }}
          >
            <input
              type="color"
              value={tag.color}
              onChange={(e) => updateTag(idx, { color: e.target.value })}
              className="w-9 h-9 rounded cursor-pointer"
              style={{ border: "1px solid var(--border-subtle)" }}
            />
            <input
              type="text"
              value={tag.name}
              onChange={(e) => updateTag(idx, { name: e.target.value })}
              className="flex-1 min-w-0 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={tag.id}
              readOnly
              className="hidden md:block px-3 py-2 text-xs text-[var(--text-tertiary)] w-32 md:w-48"
              style={{ background: "transparent" }}
            />
            <button
              onClick={() => removeTag(idx)}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[#f87171] transition"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
            タグがありません
          </p>
        )}
      </div>
    </div>
  );
}

// =============== Apportion Section ===============

function ApportionSection({
  rules,
  setRules,
}: {
  rules: ApportionRule[];
  setRules: (r: ApportionRule[]) => void;
}) {
  const allExpenseAccounts = EXPENSE_ACCOUNTS.flatMap((g) => g.options);
  const availableAccounts = allExpenseAccounts.filter(
    (opt) => !rules.some((r) => r.accountCode === opt.code)
  );

  const addRule = (code: string, label: string) => {
    setRules([
      ...rules,
      { accountCode: code, accountLabel: label, businessRatio: 50 },
    ]);
  };

  const updateRule = (idx: number, patch: Partial<ApportionRule>) => {
    setRules(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRule = (idx: number) => {
    if (!confirm("この按分ルールを削除しますか?")) return;
    setRules(rules.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="rounded-xl p-4 md:p-6"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="mb-4">
        <h2 className="text-sm md:text-base font-semibold mb-1">家事按分</h2>
        <p className="text-xs text-[var(--text-tertiary)]">
          自宅家賃・通信費・光熱費等の事業使用割合(0〜100%)
        </p>
      </div>

      {rules.length > 0 && (
        <div className="space-y-2 mb-4">
          {rules.map((rule, idx) => (
            <div
              key={rule.accountCode}
              className="flex items-center gap-2 p-2 rounded-lg min-w-0"
              style={{ background: "var(--bg-overlay)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{rule.accountLabel}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  コード: {rule.accountCode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={rule.businessRatio}
                  onChange={(e) =>
                    updateRule(idx, {
                      businessRatio: Math.max(0, Math.min(100, Number(e.target.value))),
                    })
                  }
                  className="w-20 px-3 py-2 text-sm tabular text-right"
                />
                <span className="text-sm text-[var(--text-secondary)]">%</span>
              </div>
              <input
                type="text"
                placeholder="メモ"
                value={rule.note || ""}
                onChange={(e) => updateRule(idx, { note: e.target.value })}
                className="px-3 py-2 text-xs hidden md:block w-48"
              />
              <button
                onClick={() => removeRule(idx)}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[#f87171] transition"
                title="削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 追加候補 */}
      {availableAccounts.length > 0 && (
        <div
          className="pt-4 mt-2"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
            按分する勘定科目を追加
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableAccounts.map((opt) => (
              <button
                key={opt.code}
                onClick={() => addRule(opt.code, opt.label)}
                className="text-xs px-2.5 py-1 rounded-md font-medium transition"
                style={{
                  background: "var(--bg-overlay)",
                  color: "var(--text-secondary)",
                }}
              >
                + {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============== Accounts Section ===============

function AccountsSection({
  accounts,
  setAccounts,
}: {
  accounts: AccountMaster[];
  setAccounts: (a: AccountMaster[]) => void;
}) {
  const addAccount = () => {
    const id = `acc-${Date.now().toString(36)}`;
    setAccounts([...accounts, { id, name: "新規口座", kind: "other" }]);
  };

  const updateAccount = (idx: number, patch: Partial<AccountMaster>) => {
    setAccounts(accounts.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const removeAccount = (idx: number) => {
    if (!confirm("この口座を削除しますか?")) return;
    setAccounts(accounts.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="rounded-xl p-4 md:p-6"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm md:text-base font-semibold mb-1">口座マスタ</h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            銀行・カード・電子マネーの登録(決済方法の選択肢になります)
          </p>
        </div>
        <button
          onClick={addAccount}
          className="px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1"
          style={{
            background: "var(--bg-overlay)",
            color: "var(--text-secondary)",
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          追加
        </button>
      </div>

      <div className="space-y-2">
        {accounts.map((acc, idx) => (
          <div
            key={acc.id}
            className="flex items-center gap-2 p-2 rounded-lg min-w-0"
            style={{ background: "var(--bg-overlay)" }}
          >
            <select
              value={acc.kind}
              onChange={(e) =>
                updateAccount(idx, { kind: e.target.value as AccountKind })
              }
              className="px-3 py-2 text-xs w-28 md:w-32"
            >
              {Object.entries(ACCOUNT_KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={acc.name}
              onChange={(e) => updateAccount(idx, { name: e.target.value })}
              className="flex-1 min-w-0 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="メモ"
              value={acc.note || ""}
              onChange={(e) => updateAccount(idx, { note: e.target.value })}
              className="px-3 py-2 text-xs hidden md:block w-48"
            />
            <button
              onClick={() => removeAccount(idx)}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[#f87171] transition"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
            口座がありません
          </p>
        )}
      </div>
    </div>
  );
}

// =============== Gmail Section ===============

function GmailSection({
  gmailWhitelist,
  setGmailWhitelist,
}: {
  gmailWhitelist: GmailWhitelistEntry[];
  setGmailWhitelist: (entries: GmailWhitelistEntry[]) => void;
}) {
  const generateId = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);

  const addEntry = () => {
    const newEntry: GmailWhitelistEntry = {
      id: generateId(),
      name: "",
      matchType: "from",
      matchValue: "",
      defaultAccountCode: "",
      defaultTagIds: [],
      enabled: true,
    };
    setGmailWhitelist([...gmailWhitelist, newEntry]);
  };

  const updateEntry = (idx: number, patch: Partial<GmailWhitelistEntry>) => {
    setGmailWhitelist(gmailWhitelist.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removeEntry = (idx: number) => {
    if (!confirm("この設定を削除しますか?")) return;
    setGmailWhitelist(gmailWhitelist.filter((_, i) => i !== idx));
  };

  return (
    <div className="rounded-2xl p-4 md:p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
      <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h2 className="text-sm md:text-base font-semibold mb-1">Gmail取込ホワイトリスト</h2>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Gmailから自動取込する送信者を登録。メールアドレスのドメイン or 件名キーワードで判定。
          </p>
        </div>
        <button
          onClick={addEntry}
          className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus className="w-3.5 h-3.5" />
          追加
        </button>
      </div>

      <div className="space-y-2">
        {gmailWhitelist.map((entry, idx) => (
          <div
            key={entry.id}
            className="rounded-lg p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
            style={{
              background: "var(--bg-overlay)",
              opacity: entry.enabled ? 1 : 0.5,
            }}
          >
            {/* 名前 */}
            <input
              type="text"
              value={entry.name}
              onChange={(e) => updateEntry(idx, { name: e.target.value })}
              placeholder="名前(例: 東京ガス)"
              className="px-2 py-1.5 text-sm md:col-span-3"
            />

            {/* 判定タイプ */}
            <select
              value={entry.matchType}
              onChange={(e) => updateEntry(idx, { matchType: e.target.value as "from" | "subject" })}
              className="px-2 py-1.5 text-xs md:col-span-2"
            >
              <option value="from">差出人</option>
              <option value="subject">件名</option>
            </select>

            {/* マッチ値 */}
            <input
              type="text"
              value={entry.matchValue}
              onChange={(e) => updateEntry(idx, { matchValue: e.target.value })}
              placeholder={entry.matchType === "from" ? "ドメイン例: tokyo-gas.co.jp" : "件名キーワード"}
              className="px-2 py-1.5 text-sm md:col-span-3"
            />

            {/* 勘定科目 */}
            <select
              value={entry.defaultAccountCode || ""}
              onChange={(e) => updateEntry(idx, { defaultAccountCode: e.target.value || undefined })}
              className="px-2 py-1.5 text-xs md:col-span-3"
            >
              <option value="">勘定科目: 自動</option>
              {EXPENSE_ACCOUNTS.flatMap((g) => g.options).map((a) => (
                <option key={a.code} value={a.code}>{a.label}</option>
              ))}
            </select>

            {/* ON/OFF + 削除 */}
            <div className="flex gap-1 md:col-span-1 justify-end">
              <button
                onClick={() => updateEntry(idx, { enabled: !entry.enabled })}
                className="p-2 rounded transition"
                style={{
                  background: entry.enabled ? "rgba(52, 211, 153, 0.15)" : "var(--bg-elevated)",
                  color: entry.enabled ? "#34d399" : "var(--text-tertiary)",
                }}
                title={entry.enabled ? "有効" : "無効"}
              >
                {entry.enabled ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => removeEntry(idx)}
                className="p-2 rounded text-[var(--text-tertiary)] hover:text-[#f87171] transition"
                title="削除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {gmailWhitelist.length === 0 && (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
            ホワイトリストがありません
          </p>
        )}
      </div>
    </div>
  );
}
