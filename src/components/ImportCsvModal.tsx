"use client";

import { useState, useTransition, useEffect } from "react";
import type { ImportRow, TransactionType, TransactionCategory } from "@/lib/types";
import { parseUfjBankCsv } from "@/lib/import/parseUfjBank";
import { parseUfjNicosCsv } from "@/lib/import/parseUfjNicos";
import { parseSuicaScreenshot } from "@/lib/actions/parseSuicaScreenshot";
import { parseGmailEmails } from "@/lib/actions/parseGmailEmails";
import { detectDuplicates, importTransactions } from "@/lib/actions/imports";
import { EXPENSE_ACCOUNTS, INCOME_ACCOUNTS, ALL_ACCOUNT_LABELS } from "@/lib/data/accountOptions";
import { X, Upload, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Layers } from "lucide-react";

const TAGS = [
  { id: "pbs4", name: "PBS4", color: "#4f8bff" },
  { id: "upcycle", name: "アップサイクル", color: "#34d399" },
  { id: "event", name: "イベント", color: "#fbbf24" },
  { id: "common", name: "共通", color: "#7a7f8c" },
];

const CATEGORY_OPTIONS: { value: TransactionCategory; label: string }[] = [
  { value: "business", label: "通常取引" },
  { value: "reimbursable", label: "立替金" },
  { value: "private_drawing", label: "事業主貸" },
  { value: "private_contribution", label: "事業主借" },
  { value: "tax_deductible", label: "所得控除" },
  { value: "fixed_asset", label: "固定資産" },
];

type SourceType = "ufj_bank" | "ufj_nicos" | "suica_screenshot" | "gmail";

interface Props {
  onClose: () => void;
}

export default function ImportCsvModal({ onClose }: Props) {
  const [source, setSource] = useState<SourceType>("ufj_bank");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<"individual" | "grouped">("individual");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [gmailDaysAgo, setGmailDaysAgo] = useState<number>(90);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    ok: boolean;
    imported: number;
    error?: string;
  } | null>(null);

  // Esc で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleGmailSearch = async () => {
    setParseError(null);
    setRows([]);
    setImportResult(null);
    setGmailLoading(true);

    try {
      const result = await parseGmailEmails(gmailDaysAgo);
      if (!result.ok) {
        setParseError(result.error);
        setGmailLoading(false);
        return;
      }

      if (result.rows.length === 0) {
        setParseError("対象メールが見つかりませんでした(処理: " + result.processedCount + "件)");
        setGmailLoading(false);
        return;
      }

      const dups = await detectDuplicates(result.rows);
      const dupMap = new Map(dups.map((d) => [d.rawHash, d.duplicateId]));
      const withDup = result.rows.map((r) => {
        const dupId = dupMap.get(r.rawHash);
        if (dupId) {
          return {
            ...r,
            include: false,
            duplicateOfId: dupId,
            warning: (r.warning ? r.warning + " / " : "") + "既存取引と重複",
          };
        }
        return r;
      });

      setRows(withDup);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gmail取込エラー";
      setParseError(msg);
    } finally {
      setGmailLoading(false);
    }
  };

  const handleSuicaFiles = async (files: FileList) => {
    setParseError(null);
    setRows([]);
    setImportResult(null);

    try {
      const imageData: { base64: string; mimeType: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let j = 0; j < bytes.length; j++) {
          binary += String.fromCharCode(bytes[j]);
        }
        const base64 = btoa(binary);
        imageData.push({ base64, mimeType: file.type || "image/png" });
      }

      const result = await parseSuicaScreenshot(imageData);
      if (!result.ok) {
        setParseError(result.error);
        return;
      }

      if (result.rows.length === 0) {
        setParseError("取込可能な行が見つかりませんでした");
        return;
      }

      const dups = await detectDuplicates(result.rows);
      const dupMap = new Map(dups.map((d) => [d.rawHash, d.duplicateId]));
      const withDup = result.rows.map((r) => {
        const dupId = dupMap.get(r.rawHash);
        if (dupId) {
          return {
            ...r,
            include: false,
            duplicateOfId: dupId,
            warning: (r.warning ? r.warning + " / " : "") + "既存取引と重複",
          };
        }
        return r;
      });

      setRows(withDup);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Suica画像解析エラー";
      setParseError(msg);
    }
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setRows([]);
    setImportResult(null);

    try {
      // Shift_JIS を読み込む
      const buf = await file.arrayBuffer();
      const decoder = new TextDecoder("shift-jis");
      const text = decoder.decode(buf);

      let parsed: ImportRow[] = [];
      if (source === "ufj_bank") {
        parsed = parseUfjBankCsv(text);
      } else if (source === "ufj_nicos") {
        parsed = parseUfjNicosCsv(text);
      }

      if (parsed.length === 0) {
        setParseError("取込可能な行が見つかりませんでした");
        return;
      }

      // 重複検知
      const dups = await detectDuplicates(parsed);
      const dupMap = new Map(dups.map((d) => [d.rawHash, d.duplicateId]));
      const withDup = parsed.map((r) => {
        const dupId = dupMap.get(r.rawHash);
        if (dupId) {
          return {
            ...r,
            include: false,
            duplicateOfId: dupId,
            warning: (r.warning ? r.warning + " / " : "") + "既存取引と重複",
          };
        }
        return r;
      });

      setRows(withDup);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ファイル読込エラー";
      setParseError(msg);
    }
  };

  const updateRow = (idx: number, patch: Partial<ImportRow>) => {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const toggleAll = (checked: boolean) => {
    setRows(rows.map((r) => ({ ...r, include: checked && !r.duplicateOfId })));
  };

  const handleImport = () => {
    setImportResult(null);
    startTransition(async () => {
      const result = await importTransactions(rows);
      setImportResult(result);
      if (result.ok) {
        // 3秒後にモーダル閉じる
        setTimeout(() => onClose(), 2000);
      }
    });
  };

  const selectedCount = rows.filter((r) => r.include).length;
  const totalCount = rows.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-0 md:p-6 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-5xl rounded-none md:rounded-2xl my-0 md:my-8"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase">取込</p>
            <h2 className="text-lg font-semibold">CSV取込</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 pb-24 md:pb-5">
          {/* ソース選択 */}
          <div>
            <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
              データソース
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SourceType)}
              className="w-full md:w-64 px-3 py-2.5 text-sm"
            >
              <option value="ufj_bank">三菱UFJ銀行</option>
              <option value="ufj_nicos">三菱UFJニコス</option>
              <option value="suica_screenshot">モバイルSuica (スクショ)</option>
              <option value="gmail">Gmail (請求書メール)</option>
            </select>
          </div>

          {/* Gmail検索UI */}
          {rows.length === 0 && source === "gmail" && (
            <div className="rounded-xl p-6" style={{ background: "var(--bg-overlay)", border: "1px dashed var(--border-default)" }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide mb-2 font-medium">
                    検索期間
                  </label>
                  <select
                    value={gmailDaysAgo}
                    onChange={(e) => setGmailDaysAgo(Number(e.target.value))}
                    className="w-full md:w-64 px-3 py-2.5 text-sm"
                  >
                    <option value={30}>過去30日</option>
                    <option value={60}>過去60日</option>
                    <option value={90}>過去90日</option>
                    <option value={180}>過去180日</option>
                    <option value={365}>過去365日</option>
                  </select>
                </div>
                <button
                  onClick={handleGmailSearch}
                  disabled={gmailLoading}
                  className="w-full md:w-auto px-6 py-3 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  {gmailLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {gmailLoading ? "検索中..." : "Gmailを検索して取込候補を抽出"}
                </button>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  設定タブのホワイトリストに登録されたサービスからのメールを検索。
                  Claude APIで請求書/領収書を判定し、PDF添付があれば自動保管。
                </p>
              </div>
            </div>
          )}

          {/* ファイル選択(CSV / Suicaスクショ) */}
          {rows.length === 0 && source !== "gmail" && (
            <div>
              <label
                className="flex flex-col items-center justify-center w-full px-6 py-10 rounded-xl cursor-pointer transition"
                style={{
                  background: "var(--bg-overlay)",
                  border: "1px dashed var(--border-default)",
                }}
              >
                <Upload className="w-8 h-8 text-[var(--text-tertiary)] mb-2" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  {source === "suica_screenshot" ? "Suicaスクショをアップロード(複数可)" : "CSVファイルをアップロード"}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  クリックして選択
                </p>
                {source === "suica_screenshot" ? (
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) handleSuicaFiles(files);
                    }}
                  />
                ) : (
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                )}
              </label>
              {source === "suica_screenshot" && (
                <p className="text-[11px] text-[var(--text-tertiary)] mt-2 text-center">
                  Claude APIで自動抽出します。複数枚同時アップロード可。重複は自動スキップ。
                </p>
              )}
            </div>
          )}

          {parseError && (
            <div
              className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
              style={{
                background: "rgba(248, 113, 113, 0.1)",
                color: "#f87171",
                border: "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* プレビュー */}
          {rows.length > 0 && !importResult?.ok && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  {totalCount}件検出 / {selectedCount}件取込予定
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  {/* 表示モード切替 */}
                  <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-overlay)" }}>
                    <button
                      onClick={() => setViewMode("individual")}
                      className="px-2.5 py-1 rounded text-xs font-medium transition"
                      style={{
                        background: viewMode === "individual" ? "var(--bg-elevated)" : "transparent",
                        color: viewMode === "individual" ? "var(--text-primary)" : "var(--text-tertiary)",
                      }}
                    >
                      個別
                    </button>
                    <button
                      onClick={() => setViewMode("grouped")}
                      className="px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1"
                      style={{
                        background: viewMode === "grouped" ? "var(--bg-elevated)" : "transparent",
                        color: viewMode === "grouped" ? "var(--text-primary)" : "var(--text-tertiary)",
                      }}
                    >
                      <Layers className="w-3 h-3" />
                      店名別
                    </button>
                  </div>
                  <button
                    onClick={() => toggleAll(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    style={{
                      background: "var(--bg-overlay)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    全選択
                  </button>
                  <button
                    onClick={() => toggleAll(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    style={{
                      background: "var(--bg-overlay)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    全解除
                  </button>
                </div>
              </div>

              {viewMode === "individual" ? (
                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <ImportRowCard
                      key={row.rawHash}
                      row={row}
                      onChange={(patch) => updateRow(idx, patch)}
                    />
                  ))}
                </div>
              ) : (
                <GroupedView
                  rows={rows}
                  expandedGroups={expandedGroups}
                  onToggleExpand={(name) => {
                    const next = new Set(expandedGroups);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    setExpandedGroups(next);
                  }}
                  onUpdate={updateRow}
                  onBulkToggle={(name, include) => {
                    setRows(rows.map((r) => {
                      if (r.description === name && !r.duplicateOfId) {
                        return { ...r, include };
                      }
                      return r;
                    }));
                  }}
                />
              )}

              {/* インポートボタン */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition"
                  style={{
                    background: "var(--bg-overlay)",
                    color: "var(--text-secondary)",
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleImport}
                  disabled={isPending || selectedCount === 0}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                  }}
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {selectedCount}件を取込
                </button>
              </div>
            </>
          )}

          {/* 取込結果 */}
          {importResult && (
            <div
              className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
              style={{
                background: importResult.ok
                  ? "rgba(52, 211, 153, 0.1)"
                  : "rgba(248, 113, 113, 0.1)",
                color: importResult.ok ? "#34d399" : "#f87171",
                border: importResult.ok
                  ? "1px solid rgba(52, 211, 153, 0.3)"
                  : "1px solid rgba(248, 113, 113, 0.3)",
              }}
            >
              {importResult.ok ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span>
                {importResult.ok
                  ? importResult.imported + "件を取込みました"
                  : "取込失敗: " + (importResult.error || "")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportRowCard({
  row,
  onChange,
}: {
  row: ImportRow;
  onChange: (patch: Partial<ImportRow>) => void;
}) {
  const toggleTag = (tagId: string) => {
    const newTags = row.tagIds.includes(tagId)
      ? row.tagIds.filter((t) => t !== tagId)
      : [...row.tagIds, tagId];
    onChange({ tagIds: newTags });
  };

  const isExpense = row.type === "expense";
  const accountList = isExpense
    ? EXPENSE_ACCOUNTS.flatMap((g) => g.options)
    : INCOME_ACCOUNTS;

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: row.include ? "var(--bg-overlay)" : "transparent",
        border: row.duplicateOfId
          ? "1px solid rgba(248, 113, 113, 0.3)"
          : "1px solid var(--border-subtle)",
        opacity: row.include ? 1 : 0.6,
      }}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={row.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          className="mt-1 flex-shrink-0"
        />

        <div className="flex-1 min-w-0 space-y-2">
          {/* 警告 */}
          {row.warning && (
            <div className="flex items-start gap-1.5 text-[10px]" style={{ color: "#fbbf24" }}>
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{row.warning}</span>
            </div>
          )}

          {/* 日付・金額・タイプ */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--text-tertiary)] tabular">{row.date}</span>
            <span
              className="text-sm tabular font-semibold"
              style={{ color: row.type === "income" ? "#34d399" : "#f87171" }}
            >
              {row.type === "income" ? "+" : "-"}¥{row.amount.toLocaleString()}
            </span>
          </div>

          {/* 説明 */}
          <input
            type="text"
            value={row.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full px-2 py-1.5 text-sm"
          />

          {/* カテゴリ / 勘定科目 */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={row.category}
              onChange={(e) =>
                onChange({ category: e.target.value as TransactionCategory })
              }
              className="px-2 py-1.5 text-xs"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={row.accountCode || ""}
              onChange={(e) => onChange({ accountCode: e.target.value || undefined })}
              className="px-2 py-1.5 text-xs"
            >
              <option value="">勘定科目: 未選択</option>
              {accountList.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* タグ */}
          <div className="flex flex-wrap gap-1">
            {TAGS.map((tag) => {
              const active = row.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="text-[10px] px-2 py-1 rounded font-medium transition"
                  style={{
                    background: active ? tag.color + "25" : "var(--bg-overlay)",
                    color: active ? tag.color : "var(--text-tertiary)",
                    border: "1px solid " + (active ? tag.color : "transparent"),
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupedView({
  rows,
  expandedGroups,
  onToggleExpand,
  onUpdate,
  onBulkToggle,
}: {
  rows: ImportRow[];
  expandedGroups: Set<string>;
  onToggleExpand: (name: string) => void;
  onUpdate: (idx: number, patch: Partial<ImportRow>) => void;
  onBulkToggle: (name: string, include: boolean) => void;
}) {
  // 店名でグループ化
  const groups = new Map<string, { rows: ImportRow[]; indices: number[] }>();
  rows.forEach((row, idx) => {
    const key = row.description;
    if (!groups.has(key)) {
      groups.set(key, { rows: [], indices: [] });
    }
    const g = groups.get(key)!;
    g.rows.push(row);
    g.indices.push(idx);
  });

  // 件数の多い順にソート
  const sortedGroups = Array.from(groups.entries()).sort(
    (a, b) => b[1].rows.length - a[1].rows.length
  );

  return (
    <div className="space-y-2">
      {sortedGroups.map(([name, group]) => {
        const isExpanded = expandedGroups.has(name);
        const totalAmount = group.rows.reduce((sum, r) => sum + r.amount, 0);
        const includedCount = group.rows.filter((r) => r.include).length;
        const totalCount = group.rows.length;
        const hasDuplicate = group.rows.some((r) => r.duplicateOfId);

        return (
          <div
            key={name}
            className="rounded-lg"
            style={{
              background: "var(--bg-overlay)",
              border: hasDuplicate
                ? "1px solid rgba(248, 113, 113, 0.3)"
                : "1px solid var(--border-subtle)",
            }}
          >
            {/* グループヘッダー */}
            <div className="p-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onToggleExpand(name)}
                className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex-1 min-w-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="text-sm font-medium truncate text-left">
                  {name}
                </span>
                <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                  × {totalCount}件
                </span>
              </button>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs tabular text-[var(--text-tertiary)]">
                  ¥{totalAmount.toLocaleString()}
                </span>
                <span className="text-xs text-[var(--accent)]">
                  {includedCount}/{totalCount}
                </span>
              </div>

              <div className="flex gap-1 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => onBulkToggle(name, true)}
                  className="flex-1 md:flex-initial px-2.5 py-1 rounded text-[10px] font-medium transition"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                  }}
                >
                  全件取込
                </button>
                <button
                  type="button"
                  onClick={() => onBulkToggle(name, false)}
                  className="flex-1 md:flex-initial px-2.5 py-1 rounded text-[10px] font-medium transition"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                  }}
                >
                  全件除外
                </button>
              </div>
            </div>

            {/* 展開時の個別行 */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                {group.rows.map((row, i) => (
                  <ImportRowCard
                    key={row.rawHash}
                    row={row}
                    onChange={(patch) => onUpdate(group.indices[i], patch)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
