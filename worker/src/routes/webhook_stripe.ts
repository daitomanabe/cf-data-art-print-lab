import type { Env } from "../index";
import { hmacSha256Hex, timingSafeEqualHex } from "../util/crypto";
import { fulfillOrder } from "../pod/fulfillment";

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 501 });

  const sigHeader = request.headers.get("Stripe-Signature");
  if (!sigHeader) return new Response("Missing Stripe-Signature", { status: 400 });

  const payload = await request.text();

  const ok = await verifyStripeSignature(payload, sigHeader, secret);
  if (!ok) return new Response("Invalid signature", { status: 400 });

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Handle checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const orderId = session?.metadata?.orderId;

    if (orderId) {
      const now = new Date().toISOString();

      // Extract shipping address from Stripe session
      const shippingDetails = session.shipping_details || session.customer_details;
      const shippingJson = shippingDetails ? JSON.stringify({
        name: shippingDetails.name,
        address: shippingDetails.address,
        phone: shippingDetails.phone,
      }) : null;

      // Update order to PAID with shipping info
      await env.DB
        .prepare(`
          UPDATE orders
          SET status = 'PAID',
              updated_at = ?1,
              customer_email = ?2,
              shipping_json = ?3
          WHERE id = ?4
        `)
        .bind(
          now,
          session.customer_details?.email ?? null,
          shippingJson,
          orderId
        )
        .run();

      console.log(`[Stripe Webhook] Order ${orderId} marked as PAID`);

      // Trigger POD fulfillment (async, non-blocking)
      // Use waitUntil if available, otherwise just fire and forget
      try {
        const result = await fulfillOrder(env, orderId);
        if (result.success) {
          console.log(`[Stripe Webhook] Fulfillment triggered for order ${orderId}: ${result.provider}`);
        } else {
          console.error(`[Stripe Webhook] Fulfillment failed for order ${orderId}: ${result.error}`);
        }
      } catch (err) {
        console.error(`[Stripe Webhook] Fulfillment error for order ${orderId}:`, err);
        // Don't fail the webhook - the order is still PAID
        // Admin can manually retry fulfillment
      }
    }
  }

  return new Response("ok", { status: 200 });
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  // Stripe signature format: t=timestamp,v1=signature,...
  const parts = sigHeader.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const expected = await hmacSha256Hex(secret, signedPayload);

  // Compare expected hex with provided v1
  return timingSafeEqualHex(expected, v1);
}
