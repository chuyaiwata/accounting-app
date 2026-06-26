"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

interface Props {
  monthlyData: { month: string; 売上: number; 経費: number; 損益: number }[];
  incomeByTag?: { name: string; value: number; color: string }[];
}

function formatYen(value: unknown): string {
  if (typeof value === "number") return `¥${value.toLocaleString()}`;
  if (typeof value === "string") return `¥${value}`;
  return "—";
}

export default function DashboardCharts({ monthlyData, incomeByTag }: Props) {
  const data = monthlyData || [];
  const tagData = incomeByTag || [];
  const hasData = data.some((d) => d.売上 > 0 || d.経費 > 0);
  const totalIncome = tagData.reduce((sum, m) => sum + m.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div
        className="lg:col-span-2 rounded-xl p-5"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--text-tertiary)] mb-0.5">
              月次推移
            </p>
            <h3 className="text-sm font-semibold">売上・経費・損益</h3>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[#34d399]"></span>
              売上
            </span>
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[#f87171]"></span>
              経費
            </span>
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[#4f8bff]"></span>
              損益
            </span>
          </div>
        </div>

        {hasData ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#2e3340"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#7a7f8c"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#7a7f8c"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
                    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                    return v.toString();
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#161922",
                    border: "1px solid #2e3340",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#b4b8c4" }}
                  formatter={formatYen}
                />
                <Line
                  type="monotone"
                  dataKey="売上"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#34d399" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="経費"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#f87171" }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="損益"
                  stroke="#4f8bff"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#4f8bff" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-56 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
            データを追加するとここに月次推移が表示されます
          </div>
        )}
      </div>

      <div
        className="rounded-xl p-5 flex flex-col"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="mb-2">
          <p className="text-xs text-[var(--text-tertiary)] mb-0.5">年間累計</p>
          <h3 className="text-sm font-semibold">事業別の売上</h3>
        </div>

        {tagData.length > 0 ? (
          <>
            <div className="relative h-40 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tagData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                  >
                    {tagData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#161922",
                      border: "1px solid #2e3340",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={formatYen}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] text-[var(--text-tertiary)]">合計</p>
                <p className="tabular text-sm font-semibold">
                  ¥{totalIncome.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="space-y-1.5 mt-4">
              {tagData.map((item, index) => {
                const pct = totalIncome > 0
                  ? Math.round((item.value / totalIncome) * 100)
                  : 0;
                return (
                  <div
                    key={item.name + index}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-2 text-[var(--text-secondary)] min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: item.color }}
                      ></span>
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {pct}%
                      </span>
                      <span className="tabular text-[var(--text-primary)]">
                        ¥{item.value.toLocaleString()}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-[var(--text-tertiary)] py-8">
            <p>事業別データなし</p>
            <p className="mt-1 text-[10px]">取引にタグを付けると分類されます</p>
          </div>
        )}
      </div>
    </div>
  );
}
