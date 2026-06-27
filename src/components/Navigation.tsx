"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", mobileLabel: "ホーム", icon: LayoutDashboard },
  { href: "/transactions", label: "取引", mobileLabel: "取引", icon: Receipt },
  { href: "/invoices", label: "請求書", mobileLabel: "請求書", icon: FileText, disabled: true },
  { href: "/settings", label: "設定", mobileLabel: "設定", icon: Settings },
];

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
  };
  signOutAction: () => Promise<void>;
}

export default function Navigation({ user, signOutAction }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* PC用サイドバー */}
      <aside
        className="hidden md:flex w-56 flex-col fixed top-0 left-0 h-screen px-4 py-6 z-30"
        style={{
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2.5 px-2 mb-8">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Accounting</p>
            <p className="text-[10px] text-[var(--text-tertiary)] -mt-0.5">for solo business</p>
          </div>
        </div>

        <nav className="space-y-0.5 mb-8">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            if (item.disabled) {
              return (
                <button
                  key={item.href}
                  disabled
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition opacity-40 cursor-not-allowed text-[var(--text-secondary)]"
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition " +
                  (active
                    ? "text-[var(--text-primary)] bg-[var(--bg-hover)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]")
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5 px-2 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
            >
              {(user.name || "?").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] truncate">{user.email}</p>
            </div>
          </div>
          <form action={signOutAction}>
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

      {/* モバイル用ボトムナビゲーション */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around py-2 px-2"
        style={{
          background: "var(--bg-elevated)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          if (item.disabled) {
            return (
              <button
                key={item.href}
                disabled
                className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-w-[64px] rounded-md transition opacity-40 cursor-not-allowed"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.mobileLabel}</span>
              </button>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 px-3 py-1.5 min-w-[64px] rounded-md transition"
              style={{
                color: active ? "var(--accent)" : "var(--text-tertiary)",
              }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
