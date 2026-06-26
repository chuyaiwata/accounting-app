import { auth, signIn, signOut } from "@/auth";
import AddTransactionForm from "@/components/AddTransactionForm";
import TransactionList from "@/components/TransactionList";
import DashboardCharts from "@/components/DashboardCharts";
import AnnualPL from "@/components/AnnualPL";
import { listTransactions } from "@/lib/actions/transactions";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Settings,
  LogOut,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Clock,
  Repeat,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export default async function Home() {
  const session = await auth();
  const transactions = session?.user ? await listTransactions() : [];

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const thisYear = String(now.getFullYear());

  const businessTxns = transactions.filter((t) => t.category === "business");
  const monthlyIncome = businessTxns
    .filter((t) => t.type === "income" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0);
  const prevMonthlyIncome = businessTxns
    .filter((t) => t.type === "income" && t.date.startsWith(prevMonth))
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpense = businessTxns
    .filter((t) => t.type === "expense" && t.date.startsWith(thisMonth))
    .reduce((sum, t) => sum + t.amount, 0);
  const prevMonthlyExpense = businessTxns
    .filter((t) => t.type === "expense" && t.date.startsWith(prevMonth))
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyProfit = monthlyIncome - monthlyExpense;
  const prevMonthlyProfit = prevMonthlyIncome - prevMonthlyExpense;

  const yearlyIncome = businessTxns
    .filter((t) => t.type === "income" && t.date.startsWith(thisYear))
    .reduce((sum, t) => sum + t.amount, 0);
  const yearlyExpense = businessTxns
    .filter((t) => t.type === "expense" && t.date.startsWith(thisYear))
    .reduce((sum, t) => sum + t.amount, 0);

  const unpaidAmount = transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        t.settlementStatus === "unpaid" &&
        (t.category === "business" || t.category === "reimbursable")
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const unpaidCount = transactions.filter(
    (t) =>
      t.type === "expense" &&
      t.settlementStatus === "unpaid" &&
      (t.category === "business" || t.category === "reimbursable")
  ).length;

  const unsettledIncome = transactions
    .filter(
      (t) =>
        t.type === "income" &&
        t.settlementStatus === "unpaid" &&
        (t.category === "business" || t.category === "reimbursable")
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const unsettledCount = transactions.filter(
    (t) =>
      t.type === "income" &&
      t.settlementStatus === "unpaid" &&
      (t.category === "business" || t.category === "reimbursable")
  ).length;

  const unreimbursedAmount = transactions
    .filter(
      (t) =>
        t.category === "reimbursable" &&
        t.type === "expense" &&
        t.settlementStatus === "settled"
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const reimbursedAmount = transactions
    .filter(
      (t) =>
        t.category === "reimbursable" &&
        t.type === "income" &&
        t.settlementStatus === "settled"
    )
    .reduce((sum, t) => sum + t.amount, 0);
  const netReimbursable = unreimbursedAmount - reimbursedAmount;
  const reimbursableCount = transactions.filter(
    (t) =>
      t.category === "reimbursable" &&
      t.type === "expense" &&
      t.settlementStatus === "settled"
  ).length;

  const taxDeductibleByType: Record<string, number> = {};
  transactions
    .filter(
      (t) =>
        t.category === "tax_deductible" &&
        t.date.startsWith(thisYear) &&
        t.taxDeductionType
    )
    .forEach((t) => {
      const key = t.taxDeductionType!;
      taxDeductibleByType[key] = (taxDeductibleByType[key] || 0) + t.amount;
    });
  const totalTaxDeductible = Object.values(taxDeductibleByType).reduce(
    (a, b) => a + b,
    0
  );

  const monthlyData: { month: string; 売上: number; 経費: number; 損益: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = `${d.getMonth() + 1}月`;
    const income = businessTxns
      .filter((t) => t.type === "income" && t.date.startsWith(ym))
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = businessTxns
      .filter((t) => t.type === "expense" && t.date.startsWith(ym))
      .reduce((sum, t) => sum + t.amount, 0);
    monthlyData.push({ month: monthLabel, 売上: income, 経費: expense, 損益: income - expense });
  }

  const TAG_META: Record<string, { name: string; color: string }> = {
    pbs4: { name: "PBS4", color: "#4f8bff" },
    upcycle: { name: "アップサイクル", color: "#34d399" },
    event: { name: "イベント", color: "#fbbf24" },
    common: { name: "共通", color: "#7a7f8c" },
  };
  const incomeByTag: Record<string, number> = {};
  let untaggedIncome = 0;
  businessTxns
    .filter((t) => t.type === "income" && t.date.startsWith(thisYear))
    .forEach((t) => {
      const tags = t.tagIds || [];
      if (tags.length === 0) {
        untaggedIncome += t.amount;
      } else {
        tags.forEach((tagId) => {
          incomeByTag[tagId] = (incomeByTag[tagId] || 0) + t.amount / tags.length;
        });
      }
    });
  const incomeByTagData: { name: string; value: number; color: string }[] = [];
  Object.entries(incomeByTag).forEach(([tagId, value]) => {
    const meta = TAG_META[tagId];
    if (meta) {
      incomeByTagData.push({ name: meta.name, value: Math.round(value), color: meta.color });
    }
  });
  if (untaggedIncome > 0) {
    incomeByTagData.push({ name: "未分類", color: "#4a4f5a", value: untaggedIncome });
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-muted)] mb-5">
              <Wallet className="w-7 h-7 text-[var(--accent)]" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Accounting</h1>
            <p className="text-sm text-[var(--text-secondary)]">個人事業主のためのシンプルな帳簿</p>
          </div>
          <div
            className="rounded-2xl p-8"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
              <button
                type="submit"
                className="w-full px-4 py-3 rounded-lg font-medium text-sm transition hover:opacity-90"
                style={{ background: "var(--accent)", color: "white" }}
              >
                Googleでログイン
              </button>
            </form>
            <p className="text-xs text-[var(--text-tertiary)] text-center mt-4">
              データはあなたのGoogle Driveに保存されます
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-60 flex-shrink-0 flex flex-col py-6 px-3"
        style={{
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-muted)" }}
          >
            <Wallet className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Accounting</p>
            <p className="text-[10px] text-[var(--text-tertiary)] -mt-0.5">for solo business</p>
          </div>
        </div>

        <nav className="space-y-0.5 mb-8">
          <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="ダッシュボード" active />
          <NavItem icon={<Receipt className="w-4 h-4" />} label="取引" />
          <NavItem icon={<FileText className="w-4 h-4" />} label="請求書" />
          <NavItem icon={<Settings className="w-4 h-4" />} label="設定" />
        </nav>

        <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5 px-2 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
            >
              {(session.user.name || "?").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{session.user.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] truncate">{session.user.email}</p>
            </div>
          </div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              ログアウト
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="px-10 py-8 max-w-[1400px]">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs text-[var(--text-tertiary)] mb-2 tracking-wide uppercase">
                {now.getFullYear()}年 {now.getMonth() + 1}月
              </p>
              <h1 className="text-[28px] font-semibold tracking-tight leading-none">ダッシュボード</h1>
            </div>
            <AddTransactionForm />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-10">
            <MetricCard
              label="今月の売上"
              value={monthlyIncome}
              prev={prevMonthlyIncome}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <MetricCard
              label="今月の経費"
              value={monthlyExpense}
              prev={prevMonthlyExpense}
              icon={<TrendingDown className="w-4 h-4" />}
              invertCompare
            />
            <MetricCard
              label="今月の損益"
              value={monthlyProfit}
              prev={prevMonthlyProfit}
              icon={<Wallet className="w-4 h-4" />}
              dynamicColor
            />
            <MetricCard
              label="登録件数"
              value={transactions.length}
              icon={<Receipt className="w-4 h-4" />}
              unit="件"
            />
          </div>

          <DashboardCharts monthlyData={monthlyData} incomeByTag={incomeByTagData} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10 mt-10">
            <CashFlowCard
              label="未払い"
              value={unpaidAmount}
              countLabel={`${unpaidCount}件`}
              icon={<AlertCircle className="w-4 h-4" />}
            />
            <CashFlowCard
              label="未入金"
              value={unsettledIncome}
              countLabel={`${unsettledCount}件`}
              icon={<Clock className="w-4 h-4" />}
            />
            <CashFlowCard
              label="未回収の立替金"
              value={netReimbursable}
              countLabel={`${reimbursableCount}件`}
              icon={<Repeat className="w-4 h-4" />}
            />
          </div>

          <AnnualPL
            year={thisYear}
            yearlyIncome={yearlyIncome}
            yearlyExpense={yearlyExpense}
            totalTaxDeductible={totalTaxDeductible}
          />

          {totalTaxDeductible > 0 && (
            <div className="mb-10">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase mb-1">
                    {thisYear}年
                  </p>
                  <h2 className="text-base font-semibold">所得控除の内訳</h2>
                </div>
                <p className="tabular text-xl font-semibold">
                  ¥{totalTaxDeductible.toLocaleString()}
                </p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(taxDeductibleByType).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg px-3 py-2.5"
                      style={{ background: "var(--bg-overlay)" }}
                    >
                      <p className="text-[10px] text-[var(--text-tertiary)] mb-1">
                        {taxDeductionLabel(key)}
                      </p>
                      <p className="tabular text-sm font-semibold">
                        ¥{value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase mb-1">
                最新
              </p>
              <h2 className="text-base font-semibold">取引一覧</h2>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">全 {transactions.length} 件</p>
          </div>
          <TransactionList transactions={transactions} />
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      className={
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition " +
        (active
          ? "text-[var(--text-primary)] bg-[var(--bg-hover)] font-medium"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]")
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  prev,
  icon,
  unit = "¥",
  invertCompare = false,
  dynamicColor = false,
}: {
  label: string;
  value: number;
  prev?: number;
  icon: React.ReactNode;
  unit?: string;
  invertCompare?: boolean;
  dynamicColor?: boolean;
}) {
  const formatted = unit === "¥" ? `¥${value.toLocaleString()}` : `${value.toLocaleString()}${unit}`;
  const change = prev !== undefined ? pctChange(value, prev) : null;
  const isGoodChange = change !== null && (invertCompare ? change < 0 : change > 0);
  const isBadChange = change !== null && (invertCompare ? change > 0 : change < 0);

  let valueColor = "var(--text-primary)";
  if (dynamicColor) {
    if (value > 0) valueColor = "#34d399";
    else if (value < 0) valueColor = "#f87171";
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[var(--text-secondary)] font-medium">{label}</p>
        <div style={{ color: "var(--text-tertiary)" }}>{icon}</div>
      </div>
      <p
        className="metric-value text-[28px] leading-none mb-3"
        style={{ color: valueColor }}
      >
        {formatted}
      </p>
      {change !== null ? (
        <div className="flex items-center gap-1 text-[11px]">
          <span
            className="flex items-center gap-0.5 font-medium"
            style={{
              color: isGoodChange ? "#34d399" : isBadChange ? "#f87171" : "var(--text-tertiary)",
            }}
          >
            {change >= 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-[var(--text-tertiary)]">前月比</span>
        </div>
      ) : (
        <p className="text-[11px] text-[var(--text-tertiary)]">—</p>
      )}
    </div>
  );
}

function CashFlowCard({
  label,
  value,
  countLabel,
  icon,
}: {
  label: string;
  value: number;
  countLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-5 relative overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="absolute top-0 left-0 w-0.5 h-full"
        style={{ background: "var(--border-strong)" }}
      />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div style={{ color: "var(--text-tertiary)" }}>{icon}</div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              {label}
            </p>
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)]">{countLabel}</span>
        </div>
        <p
          className="metric-value text-[28px] leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          ¥{value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function taxDeductionLabel(key: string): string {
  const labels: Record<string, string> = {
    health_insurance: "国保",
    national_pension: "年金",
    small_business_mutual: "iDeCo・共済",
    life_insurance: "生命保険",
    earthquake_insurance: "地震保険",
    medical_expense: "医療費",
    donation: "寄附金",
    other: "その他",
  };
  return labels[key] || key;
}
