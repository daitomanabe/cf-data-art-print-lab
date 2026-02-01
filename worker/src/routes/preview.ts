import type { Env } from "../index";
import { json } from "../util/http";
import { uuid } from "../util/id";
import { generateSvg } from "../artwork/generator";
import { makePreviewMetrics } from "../data/mock";

const DEFAULT_W_MM = 210;
const DEFAULT_H_MM = 297; // A4

export async function createPreview(request: Request, env: Env): Promise<Response> {
  const now = new Date();
  const body = await safeJson(request);

  // In future: use body to choose which data sources to fetch.
  // MVP: unique per request using uuid seed.
  const seed = body?.seed ?? `preview:${uuid()}`;
  const metrics = makePreviewMetrics(seed, now);

  const snapshotId = uuid();
  const sourceKey = `preview:${snapshotId}`;

  await env.DB.prepare(
    "INSERT INTO snapshots(id, created_at, kind, source_key, data_json) VALUES(?1, ?2, 'preview', ?3, ?4)"
  )
    .bind(snapshotId, now.toISOString(), sourceKey, JSON.stringify(metrics))
    .run();

  const svg = generateSvg(metrics, { width_mm: DEFAULT_W_MM, height_mm: DEFAULT_H_MM, kind: "preview" });
  const r2Key = `previews/${snapshotId}.svg`;
  await env.ART_BUCKET.put(r2Key, svg, {
    httpMetadata: { contentType: "image/svg+xml; charset=utf-8" },
    customMetadata: { kind: "preview", snapshotId },
  });

  const artworkId = uuid();
  await env.DB
    .prepare(
      "INSERT INTO artworks(id, created_at, snapshot_id, kind, r2_key, mime, width_mm, height_mm) VALUES(?1, ?2, ?3, 'preview', ?4, ?5, ?6, ?7)"
    )
    .bind(artworkId, now.toISOString(), snapshotId, r2Key, "image/svg+xml", DEFAULT_W_MM, DEFAULT_H_MM)
    .run();

  return json({
    ok: true,
    preview: {
      artworkId,
      assetPath: `/art/${r2Key}`,
      createdAt: now.toISOString(),
      widthMm: DEFAULT_W_MM,
      heightMm: DEFAULT_H_MM,
    },
  });
}

async function safeJson(req: Request): Promise<any | null> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}
