# 技術設計書（TECHNICAL DESIGN）

## 1. 要求（機能）

- 1時間ごとにサンプル生成（Cron）
- サイトで常に最新サンプルを表示
- 購入操作で「最新データ」を取得し作品生成 → プレビュー表示
- OK → 決済（Stripe Checkout）
- Webhookで支払い完了を検知し、注文を確定状態に更新
- 作品ファイルはR2に保存し、URLで参照可能にする
- 決済完了後、Gelatoに自動発注（Phase 5）

---

## 2. 非機能要件（MVP）

- **運用コスト最小**：初期は発送は手動でも成立
- **再現性**：生成に使ったデータ（Snapshot）を保存する
- **安全性**：Webhook署名検証／CORS制御／秘密情報はCF Secrets
- **可観測性**：少なくともログで追える

---

## 3. コンポーネント

### 3.1 Cloudflare Pages（フロント）

- `pages/public/*` を静的配信
- JavaScript で Worker API を呼び出す
- `public/config.js` に `workerBaseUrl` を設定（Git管理外）

### 3.2 Cloudflare Workers（API + Cron）

- HTTP API
  - `GET /api/health` - 死活確認
  - `GET /api/sample/latest` - 最新サンプル取得
  - `POST /api/preview` - プレビュー生成
  - `POST /api/checkout` - Stripe Checkout作成
  - `POST /api/webhook/stripe` - Stripe Webhook
  - `GET /art/<key>` - 作品ファイル配信
  - `GET /api/admin/orders` - 注文一覧（Phase 4、要認証）
- Cron Trigger
  - `0 * * * *`（毎時0分、UTC）
  - `scheduled()` でサンプル生成

### 3.3 Cloudflare D1（DB）

- 状態管理（snapshots / artworks / orders / pointers）
- まずは単純なSQLで十分

### 3.4 Cloudflare R2（Object Storage）

- 生成した作品（SVG、将来PDF）を保存
- `GET /art/<key>` でWorkersが配信

### 3.5 Stripe（決済）

- Checkout Session をWorkersから作成
- Webhookで決済完了を確定

### 3.6 Gelato（POD - 額装プリント）

**Phase 5で実装**

- MVPでは**手動**発注
- Phase 5でGelato APIによる自動発注

#### Gelato選定理由

| 項目 | Gelato |
|------|--------|
| 日本語対応 | ✅ ダッシュボード・サポート |
| アート品質 | ✅ ジクレー印刷対応 |
| 日本発送 | ✅ 現地パートナー（2-5日） |
| グローバル | ✅ 32ヵ国140+パートナー |
| API | ✅ REST API |

#### Gelato API統合

```
worker/src/pod/
├── index.ts      # 統一インターフェース
├── gelato.ts     # Gelato APIクライアント
└── printful.ts   # 代替（未使用）
```

#### 商品UID（額装ポスター）

| サイズ | フレーム | 商品UID |
|--------|----------|---------|
| A4 | 木製黒 | `framed_poster_wood_black_A4_210x297_mm` |
| A3 | 木製黒 | `framed_poster_wood_black_A3_297x420_mm` |
| A3 | 木製白 | `framed_poster_wood_white_A3_297x420_mm` |
| A2 | 木製黒 | `framed_poster_wood_black_A2_420x594_mm` |
| A3 | 金属銀 | `framed_poster_metal_silver_A3_297x420_mm` |

---

## 4. データフロー

### 4.1 サンプル生成（Cron）

1. `scheduled()` が起動
2. `source_key = "sample:<YYYY-MM-DDTHH>"` を作る（idempotent用）
3. Snapshot を `INSERT OR IGNORE`
4. 作品SVGを生成し、R2に保存（`samples/<snapshotId>.svg`）
5. `artworks` を作成
6. `pointers.latest_sample_artwork_id` を更新

### 4.2 プレビュー生成（購入クリック）

1. `POST /api/preview`
2. 最新データ取得（MVPはmock）
3. Snapshot 作成
4. 作品SVG生成 → R2保存（`previews/<snapshotId>.svg`）
5. `artworks` 作成
6. JSONでプレビュー情報を返却

### 4.3 決済（OK）

1. `POST /api/checkout`（body: `artworkId`）
2. `orders` を `DRAFT` で作成
3. Stripe Checkout Session 作成（metadataに orderId）
4. Checkout URL を返却

### 4.4 Webhook（決済完了）

1. `POST /api/webhook/stripe`
2. 署名検証（Stripe-Signature）
3. `checkout.session.completed` を受け取る
4. metadataから orderId を特定して `PAID` に更新

### 4.5 Gelato発注（Phase 5）

1. 注文が `PAID` になったらQueuesにエンキュー
2. Queue Consumer がGelato APIを呼び出し
3. 注文ステータスを `SUBMITTED` に更新
4. Gelato Webhookで配送ステータスを受信
5. `SHIPPED` に更新

---

## 5. DB設計（D1）

`worker/migrations/0001_init.sql` を参照。

### pointers

- `latest_sample_artwork_id`（最新サンプル参照）

### snapshots

- 作品生成の材料データ（JSON文字列）

### artworks

- R2キー、MIME、サイズなど

### orders

- 支払い状態、配送情報、POD連携IDなど
- ステータス: `DRAFT` → `PAID` → `SUBMITTED` → `SHIPPED`

---

## 6. R2キー設計

- `samples/<snapshotId>.svg`
- `previews/<snapshotId>.svg`
- `masters/<snapshotId>.pdf`（将来）

---

## 7. セキュリティ

### Secrets（wrangler secret put）

| 変数名 | 用途 |
|--------|------|
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名検証 |
| `POD_API_KEY` | Gelato API（Phase 5） |
| `ADMIN_TOKEN` | 管理API認証（Phase 4） |

### CORS

- `CORS_ALLOWED_ORIGINS` を環境変数で制御

### Webhook

- 署名検証必須（署名不一致は `400`）

### Admin操作（Phase 4）

- Bearer token認証
- 将来的にCloudflare Access / JWT等で強化

---

## 8. 実装メモ（現実の落とし穴）

- Workersで重いレンダリングをやると限界が早い。
  ベクター（SVG）で通すか、外部レンダリングに逃がす。
- 額装PODの入稿仕様はサービス毎に違う。
  **Gelatoの仕様に合わせてPDF生成を実装する。**
- 非同期処理は Cloudflare Queues を使う。
  Webhook受信 → Queue → POD発注 の流れが安全。

---

## 9. 環境変数一覧

### 非シークレット（wrangler.toml）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `APP_BASE_URL` | フロントエンドURL | `https://example.pages.dev` |
| `CORS_ALLOWED_ORIGINS` | CORS許可オリジン | `https://example.pages.dev` |
| `POD_PROVIDER` | PODプロバイダー | `manual`, `gelato` |

### シークレット（wrangler secret put）

| 変数名 | 説明 | 取得元 |
|--------|------|--------|
| `STRIPE_SECRET_KEY` | Stripe APIキー | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook署名検証 | Stripe Webhooks |
| `POD_API_KEY` | Gelato APIキー | Gelato Dashboard |
| `ADMIN_TOKEN` | 管理API認証 | 任意の文字列 |
