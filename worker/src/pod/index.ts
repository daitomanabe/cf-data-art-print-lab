/**
 * POD (Print on Demand) Module
 *
 * Phase 5で使用する自動発注機能
 * 現在は manual モードで手動運用
 */

import { GelatoClient, type GelatoOrderRequest } from "./gelato";
import { PrintfulClient, type PrintfulOrderRequest } from "./printful";

export type PODProvider = "manual" | "gelato" | "printful";

export interface PODConfig {
  provider: PODProvider;
  apiKey?: string;
}

export interface PODOrderResult {
  success: boolean;
  provider: PODProvider;
  externalOrderId?: string;
  error?: string;
}

/**
 * POD注文を作成
 *
 * @param config - POD設定
 * @param order - 注文情報
 * @returns 注文結果
 */
export async function createPODOrder(
  config: PODConfig,
  order: {
    orderId: string;
    artworkUrl: string;
    productType: string;
    shippingAddress: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      postalCode: string;
      country: string;
      phone?: string;
      email: string;
    };
  }
): Promise<PODOrderResult> {
  switch (config.provider) {
    case "manual":
      // 手動モード: 何もしない（管理画面で手動発注）
      console.log(`[POD:manual] Order ${order.orderId} requires manual fulfillment`);
      return {
        success: true,
        provider: "manual",
        externalOrderId: undefined,
      };

    case "gelato":
      if (!config.apiKey) {
        return { success: false, provider: "gelato", error: "Missing API key" };
      }
      return await createGelatoOrder(config.apiKey, order);

    case "printful":
      if (!config.apiKey) {
        return { success: false, provider: "printful", error: "Missing API key" };
      }
      return await createPrintfulOrder(config.apiKey, order);

    default:
      return { success: false, provider: config.provider, error: "Unknown provider" };
  }
}

async function createGelatoOrder(
  apiKey: string,
  order: {
    orderId: string;
    artworkUrl: string;
    productType: string;
    shippingAddress: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      postalCode: string;
      country: string;
      phone?: string;
      email: string;
    };
  }
): Promise<PODOrderResult> {
  try {
    const client = new GelatoClient({ apiKey });

    // 名前を分割（簡易的に最初のスペースで分割）
    const nameParts = order.shippingAddress.name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const gelatoOrder: GelatoOrderRequest = {
      orderReferenceId: order.orderId,
      currency: "JPY",
      items: [
        {
          productUid: order.productType, // e.g., "framed_poster_wood_black_A3_297x420_mm"
          quantity: 1,
          files: [
            {
              url: order.artworkUrl,
              type: "default",
            },
          ],
        },
      ],
      shippingAddress: {
        firstName,
        lastName,
        addressLine1: order.shippingAddress.address1,
        addressLine2: order.shippingAddress.address2,
        city: order.shippingAddress.city,
        postCode: order.shippingAddress.postalCode,
        country: order.shippingAddress.country,
        phone: order.shippingAddress.phone,
        email: order.shippingAddress.email,
      },
    };

    const result = await client.createOrder(gelatoOrder);

    return {
      success: true,
      provider: "gelato",
      externalOrderId: result.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[POD:gelato] Order failed:`, message);
    return {
      success: false,
      provider: "gelato",
      error: message,
    };
  }
}

async function createPrintfulOrder(
  apiKey: string,
  order: {
    orderId: string;
    artworkUrl: string;
    productType: string;
    shippingAddress: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      postalCode: string;
      country: string;
      phone?: string;
      email: string;
    };
  }
): Promise<PODOrderResult> {
  try {
    const client = new PrintfulClient({ accessToken: apiKey });

    // productType を variant_id に変換（実際は商品マスタから取得）
    const variantId = parseInt(order.productType, 10);
    if (isNaN(variantId)) {
      throw new Error(`Invalid variant ID: ${order.productType}`);
    }

    const printfulOrder: PrintfulOrderRequest = {
      external_id: order.orderId,
      recipient: {
        name: order.shippingAddress.name,
        address1: order.shippingAddress.address1,
        address2: order.shippingAddress.address2,
        city: order.shippingAddress.city,
        zip: order.shippingAddress.postalCode,
        country_code: order.shippingAddress.country,
        phone: order.shippingAddress.phone,
        email: order.shippingAddress.email,
      },
      items: [
        {
          variant_id: variantId,
          quantity: 1,
          files: [
            {
              url: order.artworkUrl,
              type: "default",
            },
          ],
        },
      ],
    };

    const result = await client.createOrder(printfulOrder);

    return {
      success: true,
      provider: "printful",
      externalOrderId: String(result.id),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[POD:printful] Order failed:`, message);
    return {
      success: false,
      provider: "printful",
      error: message,
    };
  }
}

export { GelatoClient, PrintfulClient };
export type { GelatoOrderRequest, PrintfulOrderRequest };
