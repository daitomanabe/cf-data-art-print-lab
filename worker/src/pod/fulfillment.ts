/**
 * POD Fulfillment Service
 *
 * Phase 5: Automatic order fulfillment via Gelato
 */

import type { Env } from "../index";
import { GelatoClient, GELATO_FRAMED_POSTER_PRODUCTS } from "./gelato";

interface OrderRow {
  id: string;
  artwork_id: string;
  customer_email: string | null;
  shipping_json: string | null;
}

interface ArtworkRow {
  id: string;
  r2_key: string;
  width_mm: number;
  height_mm: number;
}

interface ShippingAddress {
  name?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  phone?: string;
}

export interface FulfillmentResult {
  success: boolean;
  provider: string;
  externalOrderId?: string;
  error?: string;
}

/**
 * デフォルト商品UID（A3木製フレーム黒）
 * TODO: 将来的には注文時に商品選択できるようにする
 */
const DEFAULT_PRODUCT_UID = GELATO_FRAMED_POSTER_PRODUCTS.A3_WOOD_BLACK;

/**
 * 注文をPODプロバイダーに発注
 */
export async function fulfillOrder(
  env: Env,
  orderId: string
): Promise<FulfillmentResult> {
  // Manual mode: skip auto fulfillment
  if (env.POD_PROVIDER === "manual" || !env.POD_PROVIDER) {
    console.log(`[Fulfillment] Manual mode - skipping auto fulfillment for order ${orderId}`);
    return {
      success: true,
      provider: "manual",
    };
  }

  // Gelato mode
  if (env.POD_PROVIDER === "gelato") {
    if (!env.POD_API_KEY) {
      return {
        success: false,
        provider: "gelato",
        error: "POD_API_KEY not configured",
      };
    }
    return await fulfillWithGelato(env, orderId);
  }

  return {
    success: false,
    provider: env.POD_PROVIDER,
    error: `Unsupported POD provider: ${env.POD_PROVIDER}`,
  };
}

/**
 * Gelatoで発注
 */
async function fulfillWithGelato(
  env: Env,
  orderId: string
): Promise<FulfillmentResult> {
  try {
    // 注文情報を取得
    const order = await env.DB
      .prepare("SELECT id, artwork_id, customer_email, shipping_json FROM orders WHERE id = ?1")
      .bind(orderId)
      .first<OrderRow>();

    if (!order) {
      return { success: false, provider: "gelato", error: "Order not found" };
    }

    // 作品情報を取得
    const artwork = await env.DB
      .prepare("SELECT id, r2_key, width_mm, height_mm FROM artworks WHERE id = ?1")
      .bind(order.artwork_id)
      .first<ArtworkRow>();

    if (!artwork) {
      return { success: false, provider: "gelato", error: "Artwork not found" };
    }

    // 配送先を解析
    let shipping: ShippingAddress = {};
    if (order.shipping_json) {
      try {
        shipping = JSON.parse(order.shipping_json);
      } catch {
        return { success: false, provider: "gelato", error: "Invalid shipping data" };
      }
    }

    // 配送先バリデーション
    if (!shipping.address?.line1 || !shipping.address?.city || !shipping.address?.country) {
      return { success: false, provider: "gelato", error: "Incomplete shipping address" };
    }

    // 作品URLを構築（Worker経由で配信）
    const artworkUrl = `${env.APP_BASE_URL}/art/${artwork.r2_key}`;

    // 名前を分割
    const fullName = shipping.name || "Customer";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // Gelatoに発注
    const client = new GelatoClient({ apiKey: env.POD_API_KEY! });

    const gelatoOrder = await client.createOrder({
      orderReferenceId: orderId,
      currency: "JPY",
      items: [
        {
          productUid: DEFAULT_PRODUCT_UID,
          quantity: 1,
          files: [
            {
              url: artworkUrl,
              type: "default",
            },
          ],
        },
      ],
      shippingAddress: {
        firstName,
        lastName,
        addressLine1: shipping.address.line1,
        addressLine2: shipping.address.line2,
        city: shipping.address.city,
        postCode: shipping.address.postal_code || "",
        country: shipping.address.country,
        phone: shipping.phone,
        email: order.customer_email || "",
      },
    });

    // DBを更新
    const now = new Date().toISOString();
    await env.DB
      .prepare(`
        UPDATE orders
        SET status = 'SUBMITTED',
            pod_provider = 'gelato',
            pod_order_id = ?1,
            updated_at = ?2
        WHERE id = ?3
      `)
      .bind(gelatoOrder.id, now, orderId)
      .run();

    console.log(`[Fulfillment] Gelato order created: ${gelatoOrder.id} for order ${orderId}`);

    return {
      success: true,
      provider: "gelato",
      externalOrderId: gelatoOrder.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Fulfillment] Gelato error for order ${orderId}:`, errorMessage);

    // エラーをDBに記録
    const now = new Date().toISOString();
    await env.DB
      .prepare(`
        UPDATE orders
        SET status = 'FAILED',
            last_error = ?1,
            updated_at = ?2
        WHERE id = ?3
      `)
      .bind(errorMessage, now, orderId)
      .run();

    return {
      success: false,
      provider: "gelato",
      error: errorMessage,
    };
  }
}

/**
 * Gelatoの注文ステータスを同期
 */
export async function syncGelatoOrderStatus(
  env: Env,
  gelatoOrderId: string,
  gelatoStatus: string
): Promise<void> {
  // Gelatoステータスを内部ステータスにマッピング
  let internalStatus: string;
  switch (gelatoStatus) {
    case "created":
    case "passed_to_production":
      internalStatus = "SUBMITTED";
      break;
    case "shipped":
      internalStatus = "SHIPPED";
      break;
    case "cancelled":
      internalStatus = "CANCELED";
      break;
    default:
      console.log(`[Fulfillment] Unknown Gelato status: ${gelatoStatus}`);
      return;
  }

  const now = new Date().toISOString();
  await env.DB
    .prepare(`
      UPDATE orders
      SET status = ?1,
          updated_at = ?2
      WHERE pod_order_id = ?3 AND pod_provider = 'gelato'
    `)
    .bind(internalStatus, now, gelatoOrderId)
    .run();

  console.log(`[Fulfillment] Order status synced: Gelato ${gelatoOrderId} -> ${internalStatus}`);
}
