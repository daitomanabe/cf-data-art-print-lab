# worker

Cloudflare Workers（API + Cron + D1 + R2 + Stripe）の実装。

## コマンド

```bash
npm run dev                 # wrangler dev
npm run deploy              # wrangler deploy
npm run db:migrate          # D1 migrations apply（リモート）
npm run db:migrate:local    # D1 migrations apply（ローカル）
```

## 重要

- `.dev.vars` はGitに入れない（`.dev.vars.example` をコピーして使う）
- `wrangler.toml` の `database_id` / `bucket_name` は環境に合わせて設定
