# cf-data-art-print-lab

Cloudflare（Pages + Workers + D1 + R2）で動く「データ→作品→購入→（将来は）額装プリント発送」までの実験用リポジトリ。

**目的は“売上”ではなく、“動く実験”を公開すること。**  
だから最初は「ユーザーから見ると自動／裏側は手動でもOK」を前提に、最小構成でエンドツーエンドを通す。

---

## できること（MVP）

- **1時間ごと**にサンプル作品（SVG）を自動生成し、サイトに表示
- ユーザーが「購入」導線を押すと、**その瞬間の最新データ**で作品を生成してプレビュー表示
- OKなら **Stripe Checkout** に飛んで決済（テストモード）
- 決済完了Webhookを受けて注文を `PAID` に更新（発送は当面手動）

※ 額装プリント（POD）への自動発注はロードマップで後半。最初は手動で良い。

---

## アーキテクチャ（最小）

- **Cloudflare Pages**: フロント（サンプル表示、プレビュー、購入導線）
- **Cloudflare Workers**: API・Cron・Stripe連携・R2配信
- **Cloudflare D1**: スナップショット／作品／注文／ポインタ管理
- **Cloudflare R2**: 生成した作品ファイル保存（SVG / 将来PDF）

```
[Browser]
  |
  v
[Cloudflare Pages] --- fetch ---> [Cloudflare Worker API]
                                   |   |      |
                                   |   |      +--> Stripe（決済）
                                   |   |
                                   |   +--> D1（状態）
                                   |
                                   +--> R2（作品ファイル）
```

---

## リポジトリ構成

```
.
├─ docs/
│  ├─ OVERVIEW.md                 # 概要
│  ├─ TECHNICAL_DESIGN.md         # 技術設計書
│  └─ IMPLEMENTATION_ROADMAP.md   # 実装ロードマップ
├─ worker/                        # Cloudflare Workers（API + Cron）
└─ pages/                         # Cloudflare Pages（静的フロント）
```

---

## 必要なもの

- Node.js 18+（推奨20+）
- Cloudflare アカウント（Workers / Pages / D1 / R2 が使えること）
- Stripe アカウント（テストモードでOK）

---

## ローカル起動（最短）

### 1) Worker

```bash
cd worker
npm i
cp .dev.vars.example .dev.vars
# .dev.vars を編集して最低限 APP_BASE_URL / CORS_ALLOWED_ORIGINS を埋める
npm run db:migrate:local
npm run dev
```

デフォルトで `http://localhost:8787` にAPIが起動。

### 2) Pages（フロント）

```bash
cd pages
# 静的なのでビルド不要。ローカルは簡易サーバでOK
cp public/config.example.js public/config.js
# config.js の workerBaseUrl を http://localhost:8787 に
npx serve public -l 8788
```

`http://localhost:8788` を開くとサンプルとプレビュー動線が確認できる。

---

## デプロイ（概要）

**最初のデプロイはCloudflare Dashboardでもいい。**  
慣れたら `wrangler` で一気に揃える。

### Worker

1. Cloudflareで D1 と R2 を作成
2. `worker/wrangler.toml` の `database_id` / `bucket_name` を実値に置換
3. 秘密情報は `wrangler secret put` で入れる

```bash
cd worker
npm run db:migrate
npm run deploy
```

### Pages

- Cloudflare Pages で GitHub リポジトリを接続して `pages/public` を公開  
  もしくは `wrangler pages deploy` を使う（後で）。

---

## API（要点）

- `GET /api/health` : 死活
- `GET /api/sample/latest` : 最新サンプル情報
- `POST /api/preview` : 最新データでプレビュー作品生成
- `POST /api/checkout` : Stripe Checkout セッション作成（要Stripe設定）
- `POST /api/webhook/stripe` : Stripe Webhook（署名検証あり）
- `GET /art/<key>` : R2 の作品ファイル配信

詳細は `docs/TECHNICAL_DESIGN.md` を参照。

---

## 正直な注意点（ここを舐めると詰む）

- 「1時間ごとにサンプル」は簡単。でも「印刷用マスター（PDF/解像度/余白/色）」は一気に難しくなる。  
  **MVPはSVGで通して、次にPDF生成に進め。**
- StripeのWebhook署名検証を雑にすると、注文ステータスが壊れる。  
  **このリポジトリの実装は“最小の骨格”。本番運用するなら要監査。**
- 額装PODは仕様（サイズ／フレーム／紙／余白）で炎上しがち。  
  **自動化は最後。最初は手動で品質を掴め。**

---

## ライセンス

- `LICENSE` を参照（MIT）。用途に合わせて変更してOK。
