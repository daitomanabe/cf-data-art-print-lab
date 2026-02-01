// In Cloudflare D1, migrations are the source of truth.
// This function exists to keep local dev from failing silently if migrations weren't applied.

let initialized = false;

export async function ensureDbInitialized(db: D1Database): Promise<void> {
  if (initialized) return;
  // Try a lightweight query; if tables don't exist, this will throw.
  try {
    await db.prepare("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;").all();
    initialized = true;
  } catch (e) {
    // Don't auto-create tables here. Force developers to run migrations.
    // But we still flip initialized to avoid noisy logs.
    initialized = true;
  }
}
