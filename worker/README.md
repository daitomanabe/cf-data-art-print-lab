# worker

Cloudflare Workers（API + Cron + D1 + R2 + Stripe + Gelato）の実装。

## ディレクトリ構成

```
src/
├─ index.ts           # エントリーポイント（ルーティング）
├─ routes/
│  ├─ sample.ts       # GET /api/sample/latest, Cron
│  ├─ preview.ts      # POST /api/preview
│  ├─ checkout.ts     # POST /api/checkout
│  ├─ webhook_stripe.ts # POST /api/webhook/stripe
│  └─ art.ts          # GET /art/<key>
├─ pod/
│  ├─ index.ts        # POD統一インターフェース
│  ├─ gelato.ts       # Gelato APIクライアント
│  └─ printful.ts     # Printful APIクライアント（代替）
├─ db/
│  ├─ schema.ts       # 型定義
│  ├─ queries.ts      # DBクエリ
│  └─ init.ts         # 初期化
├─ artwork/
│  └─ generator.ts    # SVG生成
├─ data/
│  └─ mock.ts         # モックデータ
└─ util/
   ├─ http.ts         # HTTPヘルパー
   ├─ crypto.ts       # 暗号化
   └─ id.ts           # UUID生成
```

## コマンド

```bash
npm run dev                 # wrangler dev（ローカル開発）
npm run deploy              # wrangler deploy
npm run db:migrate          # D1 migrations apply（リモート）
npm run db:migrate:local    # D1 migrations apply（ローカル）
```

## 環境変数

### 非シークレット（wrangler.toml）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `APP_BASE_URL` | フロントエンドURL | `https://example.pages.dev` |
| `CORS_ALLOWED_ORIGINS` | CORS許可オリジン | `https://example.pages.dev` |
| `POD_PROVIDER` | PODプロバイダー | `manual`, `gelato` |

### シークレット（wrangler secret put）

| 変数名 | 説明 |
|--------|------|
| `STRIPE_SECRET_KEY` | Stripe APIキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名検証 |
| `POD_API_KEY` | Gelato APIキー（Phase 5） |
| `ADMIN_TOKEN` | 管理API認証（Phase 4） |

## POD連携（Phase 5）

### Gelato（推奨）

```typescript
import { createPODOrder } from "./pod";

const result = await createPODOrder(
  { provider: "gelato", apiKey: env.POD_API_KEY },
  {
    orderId: "order-123",
    artworkUrl: "https://example.com/art.pdf",
    productType: "framed_poster_wood_black_A3_297x420_mm",
    shippingAddress: {
      name: "山田 太郎",
      address1: "東京都渋谷区...",
      city: "渋谷区",
      postalCode: "150-0001",
      country: "JP",
      email: "test@example.com",
    },
  }
);
```

### 商品UID（額装ポスター）

| サイズ | フレーム | 商品UID |
|--------|----------|---------|
| A4 | 木製黒 | `framed_poster_wood_black_A4_210x297_mm` |
| A3 | 木製黒 | `framed_poster_wood_black_A3_297x420_mm` |
| A3 | 木製白 | `framed_poster_wood_white_A3_297x420_mm` |
| A2 | 木製黒 | `framed_poster_wood_black_A2_420x594_mm` |

## 重要

- `.dev.vars` はGitに入れない（`.dev.vars.example` をコピーして使う）
- `wrangler.toml` の `database_id` は環境に合わせて設定
- Gelato APIキーは https://www.gelato.com/ja で取得
