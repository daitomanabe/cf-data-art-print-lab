import type { Env } from "../index";
import { json } from "../util/http";
import { uuid } from "../util/id";
import { loadArtworkByIdStrict } from "../db/queries";

type CheckoutReq = {
  artworkId: string;
  // Future: size, frame options, quantity, shipping, etc.
};

export async function createCheckoutSession(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ ok: false, error: "stripe_not_configured" }, 501);
  }

  const body = (await request.json().catch(() => null)) as CheckoutReq | null;
  const artworkId = body?.artworkId;
  if (!artworkId) return json({ ok: false, error: "missing_artworkId" }, 400);

  const artwork = await loadArtworkByIdStrict(env.DB, artworkId);

  // Create order (DRAFT)
  const orderId = uuid();
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      "INSERT INTO orders(id, created_at, updated_at, status, artwork_id) VALUES(?1, ?2, ?3, 'DRAFT', ?4)"
    )
    .bind(orderId, now, now, artworkId)
    .run();

  // Stripe Checkout Session
  const session = await stripeCreateCheckoutSession(env, {
    orderId,
    artworkId,
    // Minimum for MVP: fixed price item
    amountJpy: 15000, // TODO: replace
    currency: "jpy",
    productName: "Framed data artwork (MVP)",
  });

  // Persist session id
  await env.DB
    .prepare("UPDATE orders SET stripe_session_id = ?1, updated_at = ?2 WHERE id = ?3")
    .bind(session.id, new Date().toISOString(), orderId)
    .run();

  return json({ ok: true, checkoutUrl: session.url, orderId });
}

async function stripeCreateCheckoutSession(env: Env, args: {
  orderId: string;
  artworkId: string;
  amountJpy: number;
  currency: string;
  productName: string;
}): Promise<{ id: string; url: string }> {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${env.APP_BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${env.APP_BASE_URL}/cancel.html`);

  // line_items[0]
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", args.currency);
  params.set("line_items[0][price_data][unit_amount]", String(args.amountJpy));
  params.set("line_items[0][price_data][product_data][name]", args.productName);

  // metadata
  params.set("metadata[orderId]", args.orderId);
  params.set("metadata[artworkId]", args.artworkId);

  // shipping address collection (JP only by default; adjust later)
  params.append("shipping_address_collection[allowed_countries][]", "JP");

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe create session failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as any;
  return { id: data.id, url: data.url };
}
