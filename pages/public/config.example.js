// ============================================================
// CF Data Art Print Lab - フロントエンド設定
// ============================================================
// このファイルを config.js にコピーして値を設定してください
// cp config.example.js config.js
//
// config.js は .gitignore で除外されています
// ============================================================

window.__APP_CONFIG__ = {
  // Worker API の URL
  // ローカル開発: http://localhost:8787
  // 本番: https://your-worker.your-subdomain.workers.dev
  workerBaseUrl: "http://localhost:8787",

  // デバッグモード（コンソールログ出力）
  debug: true,
};
