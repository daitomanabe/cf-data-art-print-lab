# 実装ロードマップ（IMPLEMENTATION ROADMAP）

「最小で動く」→「壊れない」→「（必要なら）自動化」の順。

---

## Phase 0: リポジトリ骨格 ✅ Done

- [x] README / docs 作成
- [x] Workers / Pages のplaceholder
- [x] D1 migrations
- [x] env example

**完了条件**
- ローカルで Worker / Pages が起動し、画面が出る

---

## Phase 1: 1時間ごとのサンプル生成 ✅ Done

- [x] Cron Triggerで `scheduled()` が動く
- [x] mockデータでSVG生成
- [x] R2保存 + D1 pointers更新
- [x] Pagesで最新サンプルが表示される

**完了条件**
- ローカルで `curl` して最新サンプルが取れる
- ブラウザでサンプルが表示される

---

## Phase 2: 購入クリック→プレビュー生成 ✅ Done

- [x] `POST /api/preview` 実装
- [x] Snapshot保存（再現性）
- [x] プレビュー表示（フロント）

**完了条件**
- クリックで別のプレビューが生成される（少なくともIDが変わる）

---

## Phase 3: Stripe Checkout（テスト）✅ Done

- [x] `POST /api/checkout` 実装（Checkout Session作成）
- [x] `POST /api/webhook/stripe` 実装（署名検証）
- [x] orders のステータス遷移 `DRAFT -> PAID`

**完了条件**
- テスト決済で `PAID` になる

---

## Phase 4: 手動フルフィルメント（"自動に見える手動"）✅ Done

- [x] 管理者用に「注文一覧」を見る方法を用意
  - `GET /api/admin/orders` 実装
  - `GET /api/admin/orders/:id` 実装
  - `PATCH /api/admin/orders/:id` 実装
  - `GET /api/admin/stats` 実装
  - 簡易認証（Bearer token）
- [x] 作品ダウンロード（管理画面から `/art/:key` へリンク）
- [x] 簡易管理画面 `pages/public/admin.html`
- [x] PODに手動発注する運用手順をdocs化（`docs/MANUAL_FULFILLMENT.md`）

**完了条件**
- 受注→手動発注→発送までを1回通せる

---

## Phase 5: Gelato自動発注 ✅ Done

**PODプロバイダー: Gelato（決定）**

選定理由:
- 日本語対応（ダッシュボード・サポート）
- ファインアート印刷（ジクレー）対応
- 日本現地パートナーで配送が速い・安い
- 32ヵ国140+パートナーのグローバルネットワーク

実装項目:
- [x] Gelato APIキー設定（`POD_API_KEY`）
- [x] 発注API実装（`worker/src/pod/fulfillment.ts`）
- [x] Stripe Webhook連携（決済完了時に自動発注）
- [x] 注文ステータス `SUBMITTED` / `SHIPPED` 追跡
- [x] Gelato Webhook受信（`/api/webhook/gelato`）
- [x] 配送追跡情報の保存（`tracking_json`）
- [x] 管理画面から手動発注/リトライ機能

商品設定:
- デフォルト: A3木製フレーム黒（`framed_poster_wood_black_A3_297x420_mm`）
- 額装ポスター（木製フレーム黒/白/ナチュラル）
- サイズ: A4, A3, A2

**完了条件**
- 決済完了から発注が自動で走る ✅
- 配送ステータスが自動更新される ✅

---

## Phase 6: 実データ導入 📋 Planned

- [ ] 睡眠/心拍のAPI連携（Oura, Fitbit等）
- [ ] ローカルアップロード（R2 presigned URL）
- [ ] Whisper文字起こし結果の取り込み（外部で生成→アップロード）

**完了条件**
- 「最新データ」がmockではなく実データになる

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Cloudflare Pages（静的HTML/CSS/JS）|
| API | Cloudflare Workers（TypeScript）|
| データベース | Cloudflare D1（SQLite）|
| ストレージ | Cloudflare R2 |
| 決済 | Stripe Checkout |
| POD | Gelato API |

---

## 登録が必要なサービス

| サービス | 必須 | 用途 |
|----------|------|------|
| Cloudflare | ✅ | Workers, Pages, D1, R2 |
| Stripe | ✅ | 決済 |
| Gelato | Phase 5 | 額装プリント自動発注 |
