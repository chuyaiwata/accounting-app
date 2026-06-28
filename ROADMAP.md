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

## データモデル
Transaction型のフィールド:
- id, date, description, amount
- category: business/reimbursable/private_drawing/private_contribution/tax_deductible/fixed_asset/prepaid/inventory/loan
- type: income/expense
- accountCode: 勘定科目コード(530=消耗品費、524=旅費交通費など)
- tagIds: pbs4/upcycle/event/common
- settlementStatus: unpaid/partial/settled
- expectedSettlementDate, actualSettlementDate
- taxDeductionType, paymentMethod, note
- reimbursableLinkId, fixedAssetId
- rawHash(CSV取込時の重複検知用)
- receiptUrl(レシート画像保管用、未実装)

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

### 完了済み
- A. レシートOCR(完了 2026-06-27)
  - Claude API(claude-haiku-4-5)、HEIC→JPEG変換
  - 構造化抽出: 金額/日付/店名/勘定科目/タグ/決済方法
  - 本番動作確認済(Cloudflare Workers)、iPhone Safari対応

- F. 取引タブ・設定タブ(完了 2026-06-28)
  - ナビゲーション共通化(PC左サイドバー/モバイルボトムナビ)
  - 取引タブ: 一覧・検索・フィルタ・編集・削除
  - 設定タブ: 事業タグ・家事按分・口座マスタ
  - iPhone Safari表示崩れ・自動ズーム対応

- C-部分. UFJ銀行/ニコスCSV取込(部分完了 2026-06-28)
  - UFJ銀行: 全件取込動作確認(8件: 取込6/プライベート除外2)
  - ニコス: パーサー実装、ヒューリスティック自動分類

- レシート画像のGoogle Drive保管(完了 2026-06-28)
  - 電子帳簿保存法(2024年義務化)対応
  - レシートOCR時に画像を accounting-app-data/receipts/ に自動保存
  - Transaction型に receiptUrl(Drive ファイルID)
  - 取引一覧に Paperclip アイコン → プレビューモーダル
  - EditModal: 画像追加/差し替え/削除(CSV取込分への後付け対応)
  - 領収書未添付の控えめな警告アイコン(事業経費のみ)
  - bodySizeLimit 10mb 拡張(iPhone撮影画像対応)
  - 本番動作確認済(iPhone Safari含む)

### 着手順(最速完成戦略)

#### 1. C-残: ニコス取込のUX改善(3〜5日)
- 店名グループ化(セブンイレブン x N件 → 一括表示)
- 「明確な事業のみ取込、残りはスキップ」モード
- Heart Oneも検討(CSV出力可能か未確認)

#### 2. H: Suica履歴取込(3〜5日)
- モバイルSuica履歴スクショ→Claude API構造化抽出
- 一括取込画面(複数取引をまとめて承認)
- 事業/私用の振り分けUI
- 月次リマインダー(26週間保持制限対応)

#### 3. D: 請求書発行(7〜10日)
- PDF生成(年度別連番、消費税表示、振込先表示)
- 源泉徴収10.21%対応
- 売掛金消込(請求書→入金→Transaction自動生成)
- 取引先マスタ(F)を前提

#### 4. E: Gmail自動取込(5〜7日)
- SoftBank光等の定期請求メール
- メールパース(CSVパース基盤を応用)
- 既にGmail権限取得済み

#### 5. G: 青色申告決算書PDF生成(10〜14日、Phase 3への橋渡し)
- 損益計算書(P/L)、月別売上・仕入
- 家事按分集計、減価償却計算
- 4ページフォーマット出力

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
- 電子帳簿保存法のタイムスタンプ・検索機能補完
- 7年保管対応のバックアップ・復元機能

## Phase 5: 任意の追加機能(余裕があれば)
- 走行距離トラッカー(車両費按分)
- 音声メモ入力
- 補助金報告用レポート
- 売上予測・税金シミュレーター

## タイムライン(更新版)
- 2026年6月末: Phase 2 A・F・C部分完了、freee解約
- 2026年7月前半: レシート画像保管 → C残・H並行
- 2026年7月後半〜8月: D → E → G
- 2026年9〜10月: Phase 3(複式簿記化)
- 2026年11月: Phase 4(e-Tax XML)
- 2026年12月: バグ修正・実データテスト
- 2027年1〜2月: 2026年度分の確定申告


## 既知の未完了項目(完成時に対応)

### Gmail 複数アカウント対応
- 現状: 1アカウント(認証中のアカウント)のみから取込
- Chuyaの実態: chuya.iwata@gmail.com + chu.chu.chuya@gmail.com の2アカウント運用
- サービスごとにメール受信アカウントが分かれてる
- 必要な実装:
  - 設定タブで複数Gmailアカウントを登録(各アカウントのOAuth)
  - 取込時に全アカウントを横断検索
  - メール検出時にどのアカウントから来たか記録
- 影響範囲: parseGmailEmails.ts, auth.ts, settings, ImportCsvModal
- 工数見積: 3〜4時間
- 優先度: Phase 2完成後の最終仕上げ

## スコープ外(対応しない論点)
- freee CSV取込(2026-06-28判断: 移行データ少なく取込実装の手間に見合わずスキップ、CSVバックアップのみGoogle Driveに保存)
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
