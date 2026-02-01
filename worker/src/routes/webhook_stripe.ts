import type { Env } from "../index";
import { hmacSha256Hex, timingSafeEqualHex } from "../util/crypto";

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

  // MVP: handle only checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const orderId = session?.metadata?.orderId;
    if (orderId) {
      const now = new Date().toISOString();
      await env.DB
        .prepare("UPDATE orders SET status = 'PAID', updated_at = ?1, customer_email = ?2 WHERE id = ?3")
        .bind(now, session.customer_details?.email ?? null, orderId)
        .run();
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
