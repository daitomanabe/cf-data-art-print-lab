# Task: CF Data Art Print Lab MVP実装

## Overview

Cloudflare Workers + Pages + D1 + R2 で動く「データ→アート→購入」のMVPを実装する。

Phase 0（リポジトリ骨格）は完了済み。Phase 1〜3を実装してエンドツーエンドを動かす。

### Goals
- Phase 1: 1時間ごとのサンプル生成
- Phase 2: 購入クリック→プレビュー生成
- Phase 3: Stripe Checkout（テストモード）

### Repository
- **GitHub**: https://github.com/daitomanabe/cf-data-art-print-lab
- **Worker**: `worker/` (Cloudflare Workers, TypeScript)
- **Pages**: `pages/public/` (静的HTML/CSS/JS)

---

## CRITICAL: 毎iteration必須事項

**全てのHatは作業完了後、イベント発行前に必ず実行:**

1. `.agent/iteration.log` に記録を追記
   ```
   [{ISO8601}] iteration #{n} | {Hat名} | {状態} | {概要}
   ```

2. Git commit & push
   ```bash
   git add -A
   git commit -m "[Ralph] {Hat名}: {完了内容}"
   git push origin main
   ```

---

## LOOP_COMPLETE時の追加処理

LOOP_COMPLETEを発行する前に:
1. `COMPLETION_REPORT.md` を生成
2. 最終 git push

---

## Hat Roles

### Git Setup
- GitHub認証確認、リモート同期
- 失敗時は即終了
- 完了後: ログ記録 → git push → git.ready

### Architect
- docs/TECHNICAL_DESIGN.md を精読
- Phase 1-3 の詳細仕様を specs/ に作成
- Worker/Pages で分担できるよう整理
- 完了後: ログ記録 → git push → specs.ready.worker, specs.ready.pages

### Worker Developer
- worker/ 配下の実装
- Phase 1: Cron + サンプル生成
- Phase 2: POST /api/preview
- Phase 3: Stripe Checkout + Webhook
- 完了後: ログ記録 → git push → worker.done

### Pages Developer
- pages/public/ 配下の実装
- Phase 1: 最新サンプル表示
- Phase 2: プレビュー表示
- Phase 3: 購入フロー
- 完了後: ログ記録 → git push → pages.done

### Integrator
- Worker + Pages 統合確認
- 各Phaseの完了条件チェック
- 問題あり → review.{worker,pages}.changes
- 全完了 → COMPLETION_REPORT.md生成 → LOOP_COMPLETE

---

## Success Criteria

### Phase 1
- [ ] Cron Triggerで `scheduled()` が動く
- [ ] mockデータでSVG生成
- [ ] R2保存 + D1 pointers更新
- [ ] Pagesで最新サンプルが表示される

### Phase 2
- [ ] `POST /api/preview` 実装
- [ ] Snapshot保存（再現性）
- [ ] プレビュー表示（フロント）

### Phase 3
- [ ] `POST /api/checkout` 実装（Checkout Session作成）
- [ ] `POST /api/webhook/stripe` 実装（署名検証）
- [ ] orders のステータス遷移 `DRAFT -> PAID`

### 最終
- [ ] 全変更がremoteにpush済み
- [ ] .agent/iteration.log が最新
- [ ] COMPLETION_REPORT.md が生成済み
- [ ] LOOP_COMPLETE

---

## Technical Notes

### Worker ローカル起動
```bash
cd worker
npm i
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
# http://localhost:8787
```

### Pages ローカル起動
```bash
cd pages
cp public/config.example.js public/config.js
npx serve public -l 8788
# http://localhost:8788
```

### 参照ドキュメント
- `docs/TECHNICAL_DESIGN.md` - API仕様、DB設計
- `docs/IMPLEMENTATION_ROADMAP.md` - フェーズ定義
- `worker/README.md` - Worker固有の情報
