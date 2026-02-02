# 手動フルフィルメント運用手順

Phase 4: 「自動に見える手動」運用ガイド

---

## 概要

決済完了後、Gelatoに手動で発注する運用フロー。
Phase 5でGelato API自動発注を実装するまでの暫定運用。

---

## 1. 事前準備

### 1.1 Admin Token設定

```bash
# ローカル開発
echo 'ADMIN_TOKEN=your-secure-token-here' >> worker/.dev.vars

# 本番環境
wrangler secret put ADMIN_TOKEN
```

### 1.2 Gelatoアカウント

1. https://www.gelato.com/ja でアカウント作成
2. 商品カタログで額装ポスターを確認
3. 価格・配送料を把握

---

## 2. 日常運用フロー

### 2.1 注文確認

1. 管理画面にアクセス: `https://your-pages.pages.dev/admin.html`
2. Admin Token でログイン
3. **PAID** ステータスの注文を確認

### 2.2 Gelato発注

1. 管理画面で注文詳細を開く
2. **Artwork** リンクから作品ファイルをダウンロード
3. Gelato Dashboard で新規注文作成:
   - 商品: 額装ポスター（木製フレーム黒 A3等）
   - アートワーク: ダウンロードしたファイルをアップロード
   - 配送先: 注文詳細の配送情報をコピー
4. 発注確定
5. 管理画面で **「発注済み」** ボタンをクリック
   - ステータスが `PAID` → `SUBMITTED` に変更

### 2.3 発送確認

1. Gelato Dashboard で発送通知を確認
2. 管理画面で該当注文の **「発送済み」** ボタンをクリック
   - ステータスが `SUBMITTED` → `SHIPPED` に変更
3. （オプション）顧客にメールで追跡番号を通知

---

## 3. ステータス遷移

```
DRAFT → PAID → SUBMITTED → SHIPPED
         │        │
         │        └→ FAILED（発注失敗時）
         │
         └→ CANCELED（キャンセル時）
```

| ステータス | 説明 | 次のアクション |
|-----------|------|---------------|
| `DRAFT` | Checkout開始、未決済 | 決済完了を待つ |
| `PAID` | 決済完了 | Gelatoに発注 |
| `SUBMITTED` | Gelatoに発注済み | 発送を待つ |
| `SHIPPED` | 発送済み | 完了 |
| `CANCELED` | キャンセル | - |
| `FAILED` | 発注失敗 | 再発注または返金 |

---

## 4. 管理API

### 4.1 認証

すべてのAdmin APIは Bearer token 認証が必要。

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-worker.workers.dev/api/admin/orders
```

### 4.2 エンドポイント

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/admin/stats` | 注文統計 |
| GET | `/api/admin/orders` | 注文一覧 |
| GET | `/api/admin/orders/:id` | 注文詳細 |
| PATCH | `/api/admin/orders/:id` | ステータス更新 |

### 4.3 注文一覧フィルタ

```bash
# PAIDのみ取得
GET /api/admin/orders?status=PAID

# ページネーション
GET /api/admin/orders?limit=20&offset=40
```

### 4.4 ステータス更新

```bash
# 発注済みに更新
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "SUBMITTED", "pod_provider": "manual"}' \
  https://your-worker.workers.dev/api/admin/orders/ORDER_ID

# 発送済みに更新
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "SHIPPED"}' \
  https://your-worker.workers.dev/api/admin/orders/ORDER_ID
```

---

## 5. トラブルシューティング

### 5.1 管理画面にアクセスできない

- `ADMIN_TOKEN` が設定されているか確認
- ブラウザのコンソールでエラーを確認
- `config.js` の `workerBaseUrl` が正しいか確認

### 5.2 作品ファイルがダウンロードできない

- R2バケットが正しく設定されているか確認
- Worker がR2にアクセスできるか確認

### 5.3 Gelatoで発注できない

- ファイル形式を確認（SVG/PDF）
- 解像度が要件を満たしているか確認
- Gelatoの商品仕様を確認

---

## 6. チェックリスト（毎日）

- [ ] 新規 `PAID` 注文を確認
- [ ] `PAID` 注文をGelatoに発注
- [ ] 発注済み注文のステータスを `SUBMITTED` に更新
- [ ] Gelatoで発送済みの注文を確認
- [ ] 発送済み注文のステータスを `SHIPPED` に更新

---

## 7. Phase 5 への移行

自動発注を実装する際:

1. `POD_PROVIDER=gelato` に変更
2. `POD_API_KEY` を設定
3. Stripe Webhook で `PAID` 検知時に自動発注
4. Gelato Webhook で配送ステータスを自動更新

詳細は `worker/src/pod/gelato.ts` を参照。
