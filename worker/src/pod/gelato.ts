/**
 * Gelato API Integration
 * https://apisupport.gelato.com/
 *
 * Phase 5: POD自動発注用
 */

export interface GelatoConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface GelatoOrderItem {
  productUid: string; // e.g., "framed_poster_wood_A4_210x297_mm"
  quantity: number;
  files: {
    url: string; // Public URL to the artwork file
    type: "default" | "front" | "back";
  }[];
}

export interface GelatoShippingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  country: string; // ISO 2-letter code, e.g., "JP"
  phone?: string;
  email: string;
}

export interface GelatoOrderRequest {
  orderReferenceId: string; // Your internal order ID
  customerReferenceId?: string;
  currency: string; // "JPY", "USD", etc.
  items: GelatoOrderItem[];
  shippingAddress: GelatoShippingAddress;
}

export interface GelatoOrderResponse {
  id: string;
  orderReferenceId: string;
  status: "created" | "passed_to_production" | "shipped" | "cancelled";
  createdAt: string;
}

const GELATO_API_BASE = "https://api.gelato.com/v3";

export class GelatoClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: GelatoConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || GELATO_API_BASE;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gelato API error: ${res.status} ${errorText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * 利用可能な商品カタログを取得
   */
  async getProducts(): Promise<unknown> {
    return this.request("GET", "/products");
  }

  /**
   * 商品の詳細（サイズ、価格など）を取得
   */
  async getProduct(productUid: string): Promise<unknown> {
    return this.request("GET", `/products/${productUid}`);
  }

  /**
   * 注文を作成
   */
  async createOrder(order: GelatoOrderRequest): Promise<GelatoOrderResponse> {
    return this.request<GelatoOrderResponse>("POST", "/orders", order);
  }

  /**
   * 注文ステータスを取得
   */
  async getOrder(orderId: string): Promise<GelatoOrderResponse> {
    return this.request<GelatoOrderResponse>("GET", `/orders/${orderId}`);
  }

  /**
   * 注文をキャンセル（生産前のみ可能）
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.request("DELETE", `/orders/${orderId}`);
  }

  /**
   * 配送料を見積もり
   */
  async getShippingQuote(params: {
    productUid: string;
    quantity: number;
    country: string;
  }): Promise<unknown> {
    return this.request("POST", "/shipping/quote", params);
  }
}

/**
 * 額装ポスターの商品UID例（Gelato）
 *
 * フォーマット: framed_poster_{frame_type}_{size}
 *
 * frame_type:
 *   - wood_black, wood_white, wood_natural
 *   - metal_black, metal_white, metal_silver, metal_gold
 *
 * size (mm):
 *   - A4: 210x297
 *   - A3: 297x420
 *   - A2: 420x594
 *   - A1: 594x841
 *
 * 例:
 *   - "framed_poster_wood_black_A3_297x420_mm"
 *   - "framed_poster_metal_silver_A2_420x594_mm"
 */
export const GELATO_FRAMED_POSTER_PRODUCTS = {
  // 木製フレーム（黒）
  A4_WOOD_BLACK: "framed_poster_wood_black_A4_210x297_mm",
  A3_WOOD_BLACK: "framed_poster_wood_black_A3_297x420_mm",
  A2_WOOD_BLACK: "framed_poster_wood_black_A2_420x594_mm",

  // 木製フレーム（白）
  A4_WOOD_WHITE: "framed_poster_wood_white_A4_210x297_mm",
  A3_WOOD_WHITE: "framed_poster_wood_white_A3_297x420_mm",

  // 木製フレーム（ナチュラル）
  A4_WOOD_NATURAL: "framed_poster_wood_natural_A4_210x297_mm",
  A3_WOOD_NATURAL: "framed_poster_wood_natural_A3_297x420_mm",

  // 金属フレーム（黒）
  A4_METAL_BLACK: "framed_poster_metal_black_A4_210x297_mm",
  A3_METAL_BLACK: "framed_poster_metal_black_A3_297x420_mm",
} as const;
