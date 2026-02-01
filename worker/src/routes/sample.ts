import type { Env } from "../index";
import { json } from "../util/http";
import { uuid, hourKeyUtc } from "../util/id";
import { generateSvg } from "../artwork/generator";
import { makeSampleMetrics } from "../data/mock";
import { setPointer, loadLatestSampleArtwork } from "../db/queries";
import { POINTER_LATEST_SAMPLE } from "../db/schema";

const DEFAULT_W_MM = 210;
const DEFAULT_H_MM = 297; // A4

export async function createHourlySample(env: Env): Promise<void> {
  const now = new Date();
  const hk = hourKeyUtc(now);
  const sourceKey = `sample:${hk}`;

  // Upsert snapshot idempotently based on sourceKey.
  const existing = await env.DB.prepare("SELECT id FROM snapshots WHERE source_key = ?1").bind(sourceKey).first<{ id: string }>();
  const snapshotId = existing?.id ?? uuid();

  if (!existing) {
    const metrics = makeSampleMetrics(now);
    await env.DB.prepare(
      "INSERT INTO snapshots(id, created_at, kind, source_key, data_json) VALUES(?1, ?2, 'sample', ?3, ?4)"
    )
      .bind(snapshotId, now.toISOString(), sourceKey, JSON.stringify(metrics))
      .run();
  }

  // Generate (or regenerate) artwork; store with snapshot id.
  const r2Key = `samples/${snapshotId}.svg`;
  const metricsRow = await env.DB.prepare("SELECT data_json FROM snapshots WHERE id = ?1").bind(snapshotId).first<{ data_json: string }>();
  const metrics = JSON.parse(metricsRow?.data_json ?? "{}");
  const svg = generateSvg(metrics, { width_mm: DEFAULT_W_MM, height_mm: DEFAULT_H_MM, kind: "sample" });

  await env.ART_BUCKET.put(r2Key, svg, {
    httpMetadata: { contentType: "image/svg+xml; charset=utf-8" },
    customMetadata: { kind: "sample", snapshotId },
  });

  // Insert artwork row (if not exists)
  const artworkId = await ensureArtwork(env, snapshotId, "sample", r2Key, "image/svg+xml", DEFAULT_W_MM, DEFAULT_H_MM);

  // Update pointer
  await setPointer(env.DB, POINTER_LATEST_SAMPLE, artworkId);
}

async function ensureArtwork(
  env: Env,
  snapshotId: string,
  kind: string,
  r2Key: string,
  mime: string,
  widthMm: number,
  heightMm: number
): Promise<string> {
  const row = await env.DB
    .prepare("SELECT id FROM artworks WHERE snapshot_id = ?1 AND kind = ?2")
    .bind(snapshotId, kind)
    .first<{ id: string }>();
  if (row?.id) return row.id;

  const id = uuid();
  await env.DB
    .prepare(
      "INSERT INTO artworks(id, created_at, snapshot_id, kind, r2_key, mime, width_mm, height_mm) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
    .bind(id, new Date().toISOString(), snapshotId, kind, r2Key, mime, widthMm, heightMm)
    .run();
  return id;
}

export async function getLatestSample(env: Env): Promise<Response> {
  const row = await loadLatestSampleArtwork(env.DB);
  if (!row) {
    return json({ ok: false, error: "no_sample_yet" }, 404);
  }
  return json({
    ok: true,
    sample: {
      artworkId: row.id,
      kind: row.kind,
      assetPath: `/art/${row.r2_key}`,
      createdAt: row.created_at,
      widthMm: row.width_mm,
      heightMm: row.height_mm,
    },
  });
}
