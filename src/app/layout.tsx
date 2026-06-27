import type { Metadata } from "next";
import { auth, signIn, signOut } from "@/auth";
import Navigation from "@/components/Navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accounting",
  description: "個人事業主のためのシンプルな帳簿",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };

  return (
    <html lang="ja">
      <body>
        {session?.user ? (
          <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
            <Navigation
              user={{ name: session.user.name, email: session.user.email }}
              signOutAction={signOutAction}
            />
            {/* モバイル用ヘッダー */}
            <header
              className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3"
              style={{
                background: "var(--bg-elevated)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                >
                  <span className="text-xs font-semibold">A</span>
                </div>
                <p className="text-sm font-semibold">Accounting</p>
              </div>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                {(session.user.name || "?").slice(0, 1)}
              </div>
            </header>
            <main className="md:ml-56 pb-20 md:pb-0">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
