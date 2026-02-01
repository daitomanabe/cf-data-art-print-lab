# Task: CF Data Art Print Lab - Refinement & Phase 4

## Overview

Phase 1-3 (MVP) は実装済み。このイテレーションでは以下を行う:

1. **コード品質向上**: エラーハンドリング、バリデーション、型安全性
2. **UI/UX改善**: ローディング状態、エラー表示、アクセシビリティ
3. **Phase 4実装**: 管理機能（注文一覧、マスターダウンロード）
4. **ドキュメント更新**: ロードマップ反映、API説明追加

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

## Hat Roles

### Git Setup
- リモート同期確認
- 完了後: git.ready

### Code Analyst
- 現状のコード品質分析
- 改善計画を specs/refinement-plan.md に記載
- 完了後: analysis.ready.worker, analysis.ready.pages, analysis.ready.admin

### Worker Refiner
- エラーハンドリング強化
- 入力バリデーション追加
- ログ出力追加
- 完了後: worker.refined

### Pages Refiner
- ローディング状態追加
- エラー表示改善
- UX向上
- 完了後: pages.refined

### Admin Builder
- Phase 4: 管理機能実装
  - GET /api/admin/orders (注文一覧)
  - GET /art/masters/:id (マスターDL)
  - pages/public/admin.html (管理画面)
- 完了後: admin.done

### Documentation Updater
- IMPLEMENTATION_ROADMAP.md 更新
- README.md に管理機能説明追加
- 完了後: docs.updated

### Integrator
- 統合確認、ビルドテスト
- 問題あり → review.{worker,pages,admin}.changes
- 全完了 → COMPLETION_REPORT.md → LOOP_COMPLETE

---

## Success Criteria

### コード品質
- [ ] TypeScript ビルドエラーなし
- [ ] 全APIでエラーハンドリング実装
- [ ] リクエストバリデーション実装

### UI/UX
- [ ] ローディングスピナー表示
- [ ] エラー時のユーザーフィードバック
- [ ] ボタンのdisabled状態管理

### Phase 4 (管理機能)
- [ ] 注文一覧API実装
- [ ] マスターダウンロード実装
- [ ] 簡易管理画面実装

### ドキュメント
- [ ] Phase 1-3 完了済みに更新
- [ ] 新API説明追加
- [ ] 環境変数説明追加

### 最終
- [ ] 全変更がremoteにpush済み
- [ ] COMPLETION_REPORT.md が生成済み
- [ ] LOOP_COMPLETE

---

## Technical Notes

### Worker ローカル起動
```bash
cd worker
npm i
npm run dev
# http://localhost:8787
```

### 新規追加予定のエンドポイント
- `GET /api/admin/orders` - 注文一覧 (要認証)
- `GET /art/masters/:id` - マスターファイル (要認証)

### 認証方式 (Phase 4)
簡易Bearer token認証:
- 環境変数 `ADMIN_TOKEN` を設定
- Header: `Authorization: Bearer {ADMIN_TOKEN}`

---

## Files to Modify

### Worker
- `worker/src/index.ts` - ルーティング追加
- `worker/src/routes/*.ts` - エラーハンドリング強化
- `worker/src/routes/admin.ts` - 新規: 管理API
- `worker/src/util/auth.ts` - 新規: 認証ヘルパー

### Pages
- `pages/public/app.js` - ローディング/エラー処理
- `pages/public/styles.css` - スピナーCSS
- `pages/public/admin.html` - 新規: 管理画面

### Docs
- `docs/IMPLEMENTATION_ROADMAP.md` - Phase完了状況更新
- `README.md` - 管理機能説明追加
