"use client";

interface Props {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  showCommas?: boolean;
}

/**
 * 請求書の単価入力と同じ挙動のシンプルな数値入力
 * - type="number" でブラウザに全角→半角・数字以外弾きを任せる
 * - フォーカス時に全選択
 * - 空欄は placeholder 表示
 */
export default function NumericInput({
  value,
  onChange,
  placeholder = "0",
  className = "",
  suffix,
  min,
  max,
  disabled,
}: Props) {
  const clamp = (n: number): number => {
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <input
        type="number"
        value={value || ""}
        min={min}
        max={max}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-transparent outline-none text-right tabular-nums"
      />
      {suffix && <span className="ml-1 text-[var(--text-tertiary)]">{suffix}</span>}
    </div>
  );
}
