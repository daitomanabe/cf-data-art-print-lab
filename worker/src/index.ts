import { json, text, withCors } from "./util/http";
import { ensureDbInitialized } from "./db/init";
import { getLatestSample, createHourlySample } from "./routes/sample";
import { createPreview } from "./routes/preview";
import { createCheckoutSession } from "./routes/checkout";
import { handleStripeWebhook } from "./routes/webhook_stripe";
import { handleGelatoWebhook } from "./routes/webhook_gelato";
import { serveArtObject } from "./routes/art";
import { listOrders, getOrder, updateOrder, getStats, retryFulfillment } from "./routes/admin";

export interface Env {
  DB: D1Database;
  ART_BUCKET: R2Bucket;

  // non-secret vars
  APP_BASE_URL: string;
  CORS_ALLOWED_ORIGINS: string;
  POD_PROVIDER: "manual" | "gelato" | "printful";

  // secrets (wrangler secret put)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  POD_API_KEY?: string;
  GELATO_WEBHOOK_SECRET?: string;
  ADMIN_TOKEN?: string;
}

function isOptions(req: Request) {
  return req.method.toUpperCase() === "OPTIONS";
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Ensure DB exists (migrations should do this, but local dev is messy)
    await ensureDbInitialized(env.DB);

    // Basic CORS (for Pages dev / different origins)
    const cors = withCors(env.CORS_ALLOWED_ORIGINS);
    if (isOptions(request)) return cors(new Response(null, { status: 204 }));

    // Health
    if (request.method === "GET" && url.pathname === "/api/health") {
      return cors(json({ ok: true, now: new Date().toISOString() }));
    }

    // Sample
    if (request.method === "GET" && url.pathname === "/api/sample/latest") {
      return cors(await getLatestSample(env));
    }

    // Preview
    if (request.method === "POST" && url.pathname === "/api/preview") {
      return cors(await createPreview(request, env));
    }

    // Checkout (Stripe)
    if (request.method === "POST" && url.pathname === "/api/checkout") {
      return cors(await createCheckoutSession(request, env));
    }

    // =========================================
    // Webhooks (no CORS needed)
    // =========================================

    // Stripe Webhook
    if (request.method === "POST" && url.pathname === "/api/webhook/stripe") {
      return await handleStripeWebhook(request, env);
    }

    // Gelato Webhook (Phase 5)
    if (request.method === "POST" && url.pathname === "/api/webhook/gelato") {
      return await handleGelatoWebhook(request, env);
    }

    // =========================================
    // Admin API (requires ADMIN_TOKEN)
    // =========================================

    // Admin: Order stats
    if (request.method === "GET" && url.pathname === "/api/admin/stats") {
      return cors(await getStats(request, env));
    }

    // Admin: List orders
    if (request.method === "GET" && url.pathname === "/api/admin/orders") {
      return cors(await listOrders(request, env));
    }

    // Admin: Get/Update single order
    const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([a-zA-Z0-9-]+)$/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      if (request.method === "GET") {
        return cors(await getOrder(request, env, orderId));
      }
      if (request.method === "PATCH") {
        return cors(await updateOrder(request, env, orderId));
      }
    }

    // Admin: Retry fulfillment
    const fulfillMatch = url.pathname.match(/^\/api\/admin\/orders\/([a-zA-Z0-9-]+)\/fulfill$/);
    if (fulfillMatch && request.method === "POST") {
      return cors(await retryFulfillment(request, env, fulfillMatch[1]));
    }

    // =========================================
    // Art serving (R2)
    // =========================================

    // Serve artwork objects from R2 through Worker
    if (request.method === "GET" && url.pathname.startsWith("/art/")) {
      return cors(await serveArtObject(request, env));
    }

    return cors(text("Not Found", 404));
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Hourly sample generation (UTC).
    // Keep it idempotent by using hour-based source_key.
    ctx.waitUntil(createHourlySample(env));
  },
};
