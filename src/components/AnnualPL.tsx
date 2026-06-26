interface Props {
  year: string;
  yearlyIncome: number;
  yearlyExpense: number;
  totalTaxDeductible: number;
}

// 所得税の簡易計算(7段階)
function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  if (taxableIncome <= 1_949_000) return taxableIncome * 0.05;
  if (taxableIncome <= 3_299_000) return taxableIncome * 0.10 - 97_500;
  if (taxableIncome <= 6_949_000) return taxableIncome * 0.20 - 427_500;
  if (taxableIncome <= 8_999_000) return taxableIncome * 0.23 - 636_000;
  if (taxableIncome <= 17_999_000) return taxableIncome * 0.33 - 1_536_000;
  if (taxableIncome <= 39_999_000) return taxableIncome * 0.40 - 2_796_000;
  return taxableIncome * 0.45 - 4_796_000;
}

export default function AnnualPL({
  year,
  yearlyIncome,
  yearlyExpense,
  totalTaxDeductible,
}: Props) {
  const businessProfit = yearlyIncome - yearlyExpense;
  const blueReturnDeduction = 650_000;
  const basicDeduction = 480_000;

  const afterBlueReturn = Math.max(businessProfit - blueReturnDeduction, 0);
  const totalDeductions = totalTaxDeductible + basicDeduction;
  const taxableIncome = Math.max(afterBlueReturn - totalDeductions, 0);

  const incomeTax = Math.floor(calcIncomeTax(taxableIncome));
  const reconstructionTax = Math.floor(incomeTax * 0.021);
  const residentTax = Math.floor(taxableIncome * 0.10);

  const totalTax = incomeTax + reconstructionTax + residentTax;
  const netIncome = businessProfit - totalTax;

  return (
    <div className="mb-10">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase mb-1">
            {year}年 累計
          </p>
          <h2 className="text-base font-semibold">年間サマリー(損益計算)</h2>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">概算値 / 簡易計算</p>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ background: "var(--border-subtle)" }}>
          <div className="p-5" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase mb-3">
              損益
            </p>
            <PLRow label="売上" value={yearlyIncome} color="#34d399" />
            <PLRow label="経費" value={-yearlyExpense} color="#f87171" />
            <Divider />
            <PLRow label="事業所得(売上 − 経費)" value={businessProfit} bold />

            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase mb-3 mt-6">
              控除
            </p>
            <PLRow label="青色申告特別控除" value={-blueReturnDeduction} muted />
            <PLRow label="基礎控除" value={-basicDeduction} muted />
            {totalTaxDeductible > 0 && (
              <PLRow label="所得控除合計" value={-totalTaxDeductible} muted />
            )}
            <Divider />
            <PLRow label="課税所得" value={taxableIncome} bold />
          </div>

          <div className="p-5" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase mb-3">
              税金見込み
            </p>
            <PLRow label="所得税" value={incomeTax} muted />
            <PLRow label="復興特別所得税" value={reconstructionTax} muted />
            <PLRow label="住民税(概算)" value={residentTax} muted />
            <Divider />
            <PLRow label="税額合計" value={totalTax} />

            <div className="mt-8">
              <p className="text-[10px] text-[var(--text-tertiary)] tracking-wide uppercase mb-2">
                手取り見込み
              </p>
              <p
                className="metric-value text-[32px] leading-none"
                style={{ color: netIncome >= 0 ? "#34d399" : "#f87171" }}
              >
                ¥{netIncome.toLocaleString()}
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-2">
                = 事業所得 − 税額合計
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PLRow({
  label,
  value,
  bold = false,
  muted = false,
  color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  color?: string;
}) {
  const sign = value < 0 ? "−" : "";
  const formatted = `${sign}¥${Math.abs(value).toLocaleString()}`;
  return (
    <div className="flex items-center justify-between py-1.5">
      <p
        className="text-xs"
        style={{
          color: muted ? "var(--text-tertiary)" : "var(--text-secondary)",
        }}
      >
        {label}
      </p>
      <p
        className="tabular text-sm"
        style={{
          color: color || (muted ? "var(--text-secondary)" : "var(--text-primary)"),
          fontWeight: bold ? 600 : 400,
        }}
      >
        {formatted}
      </p>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="my-2 h-px"
      style={{ background: "var(--border-subtle)" }}
    />
  );
}
