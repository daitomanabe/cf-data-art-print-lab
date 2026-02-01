export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), { status, headers: h });
}

export function text(body: string, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "text/plain; charset=utf-8");
  return new Response(body, { status, headers: h });
}

export function withCors(allowedOriginsCsv: string) {
  const allowed = allowedOriginsCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (res: Response) => {
    const h = new Headers(res.headers);
    const origin = h.get("access-control-allow-origin");

    // If already set, keep it.
    if (!origin) {
      // Allow only configured origins; if empty, allow none.
      // For local dev, set CORS_ALLOWED_ORIGINS=http://localhost:8788
      // NOTE: If you want to allow same-origin only, set it to your Pages URL.
      h.set("access-control-allow-origin", allowed.length ? allowed[0] : "");
    }

    h.set("access-control-allow-methods", "GET,POST,OPTIONS");
    h.set("access-control-allow-headers", "content-type,authorization");
    h.set("access-control-max-age", "86400");

    return new Response(res.body, { status: res.status, headers: h });
  };
}
