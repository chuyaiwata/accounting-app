# Accounting App ロードマップ

## アプリの目的
個人事業主のChuyaのための、freee代替の零コスト会計Webアプリ。
青色申告65万円控除、免税事業者、3事業(PBS4/アップサイクル/イベント)の按分管理対応。

## 完成の定義
2026年度分の確定申告がこのアプリ単独で完結すること(複式簿記 + B/S + e-Tax XML出力)。

## 確定アーキテクチャ(変更不可)
- フロントエンド: Next.js 16 + TypeScript + Tailwind v4
- 認証: NextAuth v5 + Google OAuth
- データ保存: Google Drive(accounting-app-dataフォルダ、JSONL形式)
- ホスティング: Cloudflare Workers (@opennextjs/cloudflare)
- OCR: Claude API (claude-haiku-4-5モデル、heic2anyでHEIC変換)
- ランニングコスト: 月数百円(Claude API、OCR分のみ)

## デザインシステム(変更不可)
- ダーク基調モダンミニマル
- 参考: Linear + Mercury
- アクセント青: #4f8bff
- データ色: 売上=#34d399(緑)、経費=#f87171(赤)、損益=#4f8bff(青)
- フォント: Inter統一、数字は.tabularクラス
- 影あり、角丸大きめ
- スマホ対応: PCは左サイドバー、モバイルはボトムナビ

## レスポンシブ
- PC(md以上): 左サイドバー、4列メトリクス、テーブル取引一覧
- モバイル(md未満): ボトムナビ、2列メトリクス、カード形式取引一覧

## データモデル(14エンティティ)
Transaction型のフィールド:
- id, date, description, amount
- category: business/reimbursable/private_drawing/private_contribution/tax_deductible/fixed_asset/prepaid/inventory/loan
- type: income/expense
- accountCode: 勘定科目コード(530=消耗品費、524=旅費交通費など)
- tagIds: pbs4/upcycle/event/common
- settlementStatus: unpaid/partial/settled
- expectedSettlementDate, actualSettlementDate
- taxDeductionType: health_insurance/national_pension/etc
- paymentMethod, note, reimbursableLinkId, fixedAssetId

## 開発スタイル(必須)
- ターミナルから cat > path << 'EOF' で全文上書き
- VS Codeは使わない(保存忘れ事故が頻発)
- 編集は python3 スクリプトを /tmp/ に書き出して実行
- 確認は npx tsc --noEmit
- デプロイは npm run deploy(rm -rf .open-next .next が必要な場合あり)
- 最大2問のみ確認質問、それ以上は実装優先
- 全文ファイル提示、差分は使わない
- 説明は最小限、コードと実行コマンドを優先

## Phase 1(完了)
- Google認証 + Drive保存 + Gmail権限
- 取引入力(6カテゴリ、タグ、決済管理)
- 取引一覧(状態バッジ、決済処理、削除)
- ダッシュボード(月次推移、事業別売上ドーナツ、キャッシュフロー、所得控除集計、年間サマリーP/L)
- レスポンシブ対応(PC/モバイル)
- アクセストークン自動更新
- Cloudflare Workersデプロイ
- GitHub バックアップ完了

## Phase 2 (進行中)

### A. レシートOCR(完了 2026-06-27)
- Claude API(claude-haiku-4-5モデル)
- HEIC→JPEG変換(heic2any)
- 構造化抽出: 金額/日付/店名/勘定科目/タグ/決済方法
- 本番動作確認済み(Cloudflare Workers)
- iPhone Safari対応(写真ライブラリ選択可能、表示崩れ修正)

### 着手順(最速完成戦略)

1. F: 取引タブ・設定タブ実装(3〜5日)
   - 取引一覧の編集・削除・検索・フィルタ
   - 設定タブ(取引先マスタ、事業タグ管理、家事按分率)
   - 他機能の前提となるUI基盤

2. B: freee CSV取込(3〜5日)
   - 2026年4月開業〜現在までのfreeeデータ移行
   - CSVパース基盤を確立(以降のC・Eで再利用)

3. C: 銀行/カードCSV取込 + H: Suica履歴取込(並行、合計7〜10日)
   - C: 三菱UFJ銀行・三菱UFJニコス・Heart One(家賃カード)
   - H: モバイルSuica履歴スクショ→Claude API構造化抽出
   - 重複検知ロジック共通実装

4. D: 請求書発行(7〜10日)
   - PDF生成(年度別連番、消費税表示、振込先表示)
   - 源泉徴収10.21%対応
   - 売掛金消込(請求書→入金→Transaction自動生成)
   - 取引先マスタ(F)を前提

5. E: Gmail自動取込(5〜7日)
   - SoftBank光等の定期請求メール
   - メールパース(C/HのCSVパース基盤を応用)

6. G: 青色申告決算書PDF生成(10〜14日、Phase 3への橋渡し)

### Phase 2 詳細

- B. freee CSV取込
  - 過去データ移行用
  - freeeのCSVフォーマットに対応
  - 重複検知

- C. 銀行/カードCSV取込
  - 三菱UFJ銀行のCSV対応
  - 三菱UFJニコスのCSV対応
  - Heart One(家賃カード)のCSV対応
  - 重複検知、自動仕訳(店名→勘定科目推定)

- D. 請求書発行
  - PDF生成(React-PDF or pdf-lib)
  - 取引先マスタ連携
  - 年度別連番(例: 2026-001)
  - 源泉徴収10.21%対応(報酬請求時)
  - 売掛金消込ロジック
  - 発行→入金確認→Transaction自動生成

- E. Gmail自動取込
  - SoftBank光等の定期請求メール対応
  - 既にGmail権限取得済み
  - メール本文・添付PDFから金額・支払日抽出

- F. 取引タブ・設定タブ実装
  - 取引タブ: 一覧・編集・削除・検索・フィルタ(月別/勘定科目/事業タグ/金額範囲)
  - 設定タブ: 取引先マスタ、事業タグ管理、家事按分率設定、各種マスタ

- G. 青色申告決算書PDF生成
  - 損益計算書(P/L)
  - 月別売上・仕入
  - 家事按分集計
  - 減価償却計算
  - 4ページフォーマット出力

- H. Suica履歴取込(スクショOCR方式)
  - Apple Wallet/モバイルSuica履歴のスクショから取引抽出
  - Claude APIで駅名・運賃・日付を構造化抽出
  - 一括取込画面(複数取引をまとめて承認)
  - 事業/私用の振り分けUI
  - 月次リマインダー(26週間保持制限対応)

## Phase 3: 簿記・税務(推定3〜4週間)
- 複式簿記エンジン(単式→借方/貸方変換)
- 仕訳ルール(事業主貸/借、現金/普通預金/売掛金/買掛金)
- 期首残高設定、期末処理
- 仕訳帳・総勘定元帳
- 補助簿(現金出納帳、預金出納帳、売掛帳、買掛帳、経費帳、固定資産台帳)
- 試算表(合計残高試算表)
- 損益計算書(P/L)、貸借対照表(B/S)
- リアルタイム税額ダッシュボード(所得税・住民税・国保見込)
- 各種控除計算(青色65万円、基礎、社会保険料、医療費、寄附金、小規模企業共済等)
- 青色申告決算書PDF出力(4ページフォーマット)
- 確定申告書BのPDF出力

## Phase 4: e-Tax & 仕上げ(推定1〜2週間)
- e-Tax用XML(.xtx)エクスポート(65万円控除の必須要件)
- 電子帳簿保存法対応
  - 検索機能(日付・金額・取引先)
  - 訂正削除履歴の保持
  - スキャナ保存(レシート画像のタイムスタンプ)
- 領収書画像の長期保存(7年保管義務)
- バックアップ・復元機能

## Phase 5: 任意の追加機能(余裕があれば)
- 走行距離トラッカー(車両費按分)
- 音声メモ入力
- 補助金報告用レポート
- 売上予測・税金シミュレーター

## タイムライン
- 2026年7月: Phase 2 F → B → C+H並行
- 2026年8月: Phase 2 D → E → G
- 2026年9〜10月: Phase 3(複式簿記化)
- 2026年11月: Phase 4(e-Tax XML)
- 2026年12月: バグ修正・実データテスト
- 2027年1〜2月: 2026年度分の確定申告

## スコープ外(対応しない論点)
- 専従者給与(家族雇用なし)
- 貸倒引当金(売掛金少額のため)
- 開業費(既に開業済み)
- 株式・仮想通貨(特定口座源泉徴収のため申告不要)
- 雑所得(該当なし)
- 業務委託支払調書(外注なし)
- 配偶者/扶養控除(該当者なし)
- 消費税申告(免税事業者のため、将来課税事業者化したらPhase 6として対応)

## ユーザー情報
- Chuya Iwata / chuya.iwata@gmail.com / Tokyo
- 個人事業主(2026年4月開業、青色申告65万円控除、免税事業者)
- 3事業: PBS4(iOSアプリ)、アップサイクル(ピックルボール球→3Dプリンタフィラメント)、イベント運営
- 銀行: 三菱UFJ銀行のみ、カード: 三菱UFJニコス、Heart One(家賃)
- 電子マネー: PayPay、Suica、ハチペイ
- マイナンバーカード所持、e-Tax電子申告希望
- 配偶者/扶養なし、外注なし、雑所得なし
