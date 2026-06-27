"use client";

import { useState, useTransition } from "react";
import type {
  AppSettings,
  BusinessTag,
  ApportionRule,
  AccountMaster,
  AccountKind,
} from "@/lib/types";
import { saveSettings } from "@/lib/actions/settings";
import { EXPENSE_ACCOUNTS } from "@/lib/data/accountOptions";
import { Tag as TagIcon, Percent, Wallet, Plus, Trash2, Loader2, Save } from "lucide-react";

interface Props {
  initialSettings: AppSettings;
}

type SectionKey = "tags" | "apportion" | "accounts";

const SECTIONS: { key: SectionKey; label: string; icon: typeof TagIcon }[] = [
  { key: "tags", label: "事業タグ", icon: TagIcon },
  { key: "apportion", label: "家事按分", icon: Percent },
  { key: "accounts", label: "口座マスタ", icon: Wallet },
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
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const handleSave = () => {
    setSaveStatus("idle");
    startTransition(async () => {
      const res = await saveSettings({
        businessTags: tags,
        apportionRules: rules,
        accounts,
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
            className="flex items-center gap-2 p-2 rounded-lg"
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
              className="flex-1 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={tag.id}
              readOnly
              className="px-3 py-2 text-xs text-[var(--text-tertiary)] w-32 md:w-48"
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
              className="flex items-center gap-2 p-2 rounded-lg"
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
            className="flex items-center gap-2 p-2 rounded-lg"
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
              className="flex-1 px-3 py-2 text-sm"
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
