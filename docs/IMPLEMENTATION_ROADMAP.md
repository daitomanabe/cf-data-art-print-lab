# 実装ロードマップ（IMPLEMENTATION ROADMAP）

「最小で動く」→「壊れない」→「（必要なら）自動化」の順。

---

## Phase 0: リポジトリ骨格（Done / This commit）

- [x] README / docs 作成
- [x] Workers / Pages のplaceholder
- [x] D1 migrations
- [x] env example

**完了条件**
- ローカルで Worker / Pages が起動し、画面が出る

---

## Phase 1: 1時間ごとのサンプル生成

- [ ] Cron Triggerで `scheduled()` が動く
- [ ] mockデータでSVG生成
- [ ] R2保存 + D1 pointers更新
- [ ] Pagesで最新サンプルが表示される

**完了条件**
- ローカルで `curl` して最新サンプルが取れる
- ブラウザでサンプルが表示される

---

## Phase 2: 購入クリック→プレビュー生成

- [ ] `POST /api/preview` 実装
- [ ] Snapshot保存（再現性）
- [ ] プレビュー表示（フロント）

**完了条件**
- クリックで別のプレビューが生成される（少なくともIDが変わる）

---

## Phase 3: Stripe Checkout（テスト）

- [ ] `POST /api/checkout` 実装（Checkout Session作成）
- [ ] `POST /api/webhook/stripe` 実装（署名検証）
- [ ] orders のステータス遷移 `DRAFT -> PAID`

**完了条件**
- テスト決済で `PAID` になる

---

## Phase 4: 手動フルフィルメント（“自動に見える手動”）

- [ ] 管理者用に「注文一覧」を見る方法を用意（ログでも可）
- [ ] 作品マスターのダウンロード（/art/masters/...）
- [ ] PODに手動発注する運用手順をdocs化

**完了条件**
- 受注→手動発注→発送までを1回通せる

---

## Phase 5: POD自動発注（必要なら）

- [ ] Gelato / Printful 等のどれかを1社に絞る
- [ ] 発注API実装（Queuesで非同期化推奨）
- [ ] 注文ステータス `SUBMITTED` / `SHIPPED` を追跡

**完了条件**
- 決済完了から発注が自動で走る

---

## Phase 6: 実データ導入

- [ ] 睡眠/心拍のAPI連携
- [ ] ローカルアップロード（R2 presigned URL）
- [ ] Whisper文字起こし結果の取り込み（外部で生成→アップロード）

**完了条件**
- 「最新データ」がmockではなく実データになる

