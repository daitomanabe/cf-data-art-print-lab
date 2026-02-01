import type { Env } from "../index";

export async function serveArtObject(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.pathname.replace(/^\/art\//, "");
  if (!key) return new Response("Bad Request", { status: 400 });

  const obj = await env.ART_BUCKET.get(key);
  if (!obj) return new Response("Not Found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);

  // Cache friendly: if you change content, change key.
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(obj.body, { headers });
}
