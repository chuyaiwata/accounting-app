# 自作会計アプリ - Claude向け引き継ぎ

## プロジェクト概要
- 目的: freee代替の自作会計Webアプリ。確定申告(青色申告65万円控除)を完結させる
- スタック: Next.js 16 + TypeScript + Tailwind v4 + NextAuth + Cloudflare Workers
- データ: Google Drive に JSONL 保存
- 本番URL: https://accounting-app.chuyaiwata.workers.dev

## ユーザー情報
- 岩田宙也(chuya.iwata@gmail.com)、個人事業主、2026-04-22開業
- 3事業: PBS4(iOSアプリ)、アップサイクル、イベント運営
- 銀行: 三菱UFJ銀行(三軒茶屋支店)、カード: ニコス + Heart One

## 会計方針(確定済み)
- 口座A(売上受取、残高¥2,509): アプリ未登録
- 口座B(引落運用、4/22残高¥2,324,442): アプリの「普通預金(三菱UFJ)」として登録
- 「②改方式」: B口座を事業用として登録するが、プライベートな動き
  (プルデンシャル¥2,222,368入金、生活費引出、Suicaチャージ等)はアプリに記録しない
- 期末ズレは「事業主貸」で調整

## 完了済み(Phase 1-3)
- 取引CRUD、レシートOCR(claude-haiku-4-5)、Suica画面取込
- Gmail自動取込(複数アカウント対応、24社ホワイトリスト)
- 請求書PDF生成(pdf-lib + M PLUS 1p)
- 仕訳エンジン(37科目マスタ、自動分類)
- 損益計算書/貸借対照表/試算表(借方=貸方一致確認済み)
- 旧勘定科目コード(524等)→新コード変換
- 期首残高UI(設定→期首残高タブ)

## 開発スタイル
- 実装第一、最小diff、変更後 `npx tsc --noEmit` で型確認
- Python script を /tmp/ に書いて TypeScript ファイルを編集
- TypeScript の generics を含むコードは heredoc 不可、Python経由必須
- デプロイ: `npm run deploy` (OpenNext経由でCloudflare Workers)
- terse/directive、コードベース分析より実装優先、日本語

## 重要ファイル
- src/lib/types/index.ts (Transaction, JournalEntry, OpeningBalance等)
- src/lib/data/journalAccounts.ts (37科目マスタ)
- src/lib/actions/journalEngine.ts (transactionToJournal)
- src/lib/actions/journalReports.ts (P/L/B/S/試算表)
- src/lib/actions/settings.ts (loadSettings/saveSettings)
- src/components/SettingsPage.tsx (OpeningBalanceSection追加済み)
- src/components/ReportsPage.tsx

## 今のタスク
1. B/Sアンバランス修正 ← 進行中
   期首残高 ¥2,324,442 入力したが「元入金」が純資産に立たない
   方針: getBalanceSheet で openingBalances から元入金を算出して equity に追加
2. 既存取引で「現金 ¥2,324,442」になってるのを「普通預金」に修正
3. 家事按分の自動適用
4. 期末処理(減価償却、棚卸し、開業費繰延)
5. 青色申告決算書PDF(4ページ)
6. 確定申告書B(第一表/第二表)
7. e-Tax XML出力(オプション)

## 次セッション開始時
このファイルを読んで現状把握。残タスクのトップから着手。
