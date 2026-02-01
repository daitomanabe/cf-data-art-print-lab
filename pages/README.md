# pages

Cloudflare Pages で配信する静的フロント。

- `public/` をそのままデプロイすれば動く
- `public/config.js` に Worker のURLを設定する

## ローカル

```bash
cp public/config.example.js public/config.js
# config.js の workerBaseUrl を設定
npx serve public -l 8788
```
