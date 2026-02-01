import { POINTER_LATEST_SAMPLE } from "./schema";

export async function getPointer(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM pointers WHERE key = ?1").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setPointer(db: D1Database, key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO pointers(key, value, updated_at) VALUES(?1, ?2, ?3) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    )
    .bind(key, value, now)
    .run();
}

export async function loadArtworkById(db: D1Database, artworkId: string) {
  return await db
    .prepare("SELECT * FROM artworks WHERE id = ?1")
    .bind(artworkId)
    .first<any>();
}

export async function loadArtworkByIdStrict(db: D1Database, artworkId: string) {
  const row = await loadArtworkById(db, artworkId);
  if (!row) throw new Error(`Artwork not found: ${artworkId}`);
  return row;
}

export async function loadLatestSampleArtwork(db: D1Database) {
  const id = await getPointer(db, POINTER_LATEST_SAMPLE);
  if (!id) return null;
  return await loadArtworkById(db, id);
}
