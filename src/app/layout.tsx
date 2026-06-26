import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accounting",
  description: "個人事業主のためのシンプルな帳簿",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}