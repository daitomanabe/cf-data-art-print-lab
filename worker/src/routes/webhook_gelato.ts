/**
 * Gelato Webhook Handler
 *
 * Phase 5: Receive order status updates from Gelato
 *
 * Gelato sends webhooks for:
 * - order.created
 * - order.passed_to_production
 * - order.shipped
 * - order.cancelled
 *
 * Setup:
 * 1. Go to Gelato Dashboard → Settings → Webhooks
 * 2. Add endpoint: https://your-worker.workers.dev/api/webhook/gelato
 * 3. Select events: order.shipped, order.cancelled
 * 4. Copy the signing secret to GELATO_WEBHOOK_SECRET
 */

import type { Env } from "../index";
import { syncGelatoOrderStatus } from "../pod/fulfillment";
import { hmacSha256Hex, timingSafeEqualHex } from "../util/crypto";

interface GelatoWebhookPayload {
  event: string;
  data: {
    orderId: string;
    orderReferenceId: string;
    status: string;
    shipment?: {
      trackingCode?: string;
      trackingUrl?: string;
      carrier?: string;
    };
  };
}

export async function handleGelatoWebhook(request: Request, env: Env): Promise<Response> {
  // Gelato webhook secret is optional for now
  // In production, you should verify the signature
  const secret = env.GELATO_WEBHOOK_SECRET;

  // Get signature from header (Gelato uses X-Gelato-Signature)
  const sigHeader = request.headers.get("X-Gelato-Signature");

  const payload = await request.text();

  // Verify signature if secret is configured
  if (secret && sigHeader) {
    const isValid = await verifyGelatoSignature(payload, sigHeader, secret);
    if (!isValid) {
      console.error("[Gelato Webhook] Invalid signature");
      return new Response("Invalid signature", { status: 400 });
    }
  }

  let event: GelatoWebhookPayload;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  console.log(`[Gelato Webhook] Received: ${event.event}`, JSON.stringify(event.data));

  // Handle different event types
  switch (event.event) {
    case "order.created":
    case "order.passed_to_production":
      await syncGelatoOrderStatus(env, event.data.orderId, "passed_to_production");
      break;

    case "order.shipped":
      await handleShipped(env, event.data);
      break;

    case "order.cancelled":
      await syncGelatoOrderStatus(env, event.data.orderId, "cancelled");
      break;

    default:
      console.log(`[Gelato Webhook] Unhandled event type: ${event.event}`);
  }

  return new Response("ok", { status: 200 });
}

/**
 * Handle shipped event - update status and store tracking info
 */
async function handleShipped(
  env: Env,
  data: GelatoWebhookPayload["data"]
): Promise<void> {
  const now = new Date().toISOString();

  // Build tracking info JSON if available
  let trackingJson: string | null = null;
  if (data.shipment) {
    trackingJson = JSON.stringify({
      trackingCode: data.shipment.trackingCode,
      trackingUrl: data.shipment.trackingUrl,
      carrier: data.shipment.carrier,
    });
  }

  // Update order with shipped status and tracking info
  await env.DB
    .prepare(`
      UPDATE orders
      SET status = 'SHIPPED',
          updated_at = ?1,
          tracking_json = ?2
      WHERE pod_order_id = ?3 AND pod_provider = 'gelato'
    `)
    .bind(now, trackingJson, data.orderId)
    .run();

  console.log(`[Gelato Webhook] Order shipped: ${data.orderId}, tracking: ${data.shipment?.trackingCode}`);
}

/**
 * Verify Gelato webhook signature
 * Gelato uses HMAC-SHA256 with the raw body
 */
async function verifyGelatoSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const expected = await hmacSha256Hex(secret, payload);
    return timingSafeEqualHex(expected, signature);
  } catch {
    return false;
  }
}
