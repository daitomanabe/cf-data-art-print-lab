/**
 * Printful API Integration
 * https://developers.printful.com/docs/
 *
 * Phase 5: POD自動発注用（Gelato代替）
 */

export interface PrintfulConfig {
  accessToken: string;
  storeId?: string;
  baseUrl?: string;
}

export interface PrintfulRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string; // ISO 2-letter code
  zip: string;
  phone?: string;
  email: string;
}

export interface PrintfulOrderItem {
  variant_id: number; // Printful variant ID
  quantity: number;
  files: {
    url: string;
    type: "default" | "front" | "back";
  }[];
}

export interface PrintfulOrderRequest {
  external_id?: string; // Your internal order ID
  recipient: PrintfulRecipient;
  items: PrintfulOrderItem[];
  retail_costs?: {
    currency: string;
    subtotal: string;
    discount: string;
    shipping: string;
    tax: string;
  };
}

export interface PrintfulOrderResponse {
  id: number;
  external_id: string;
  status: "draft" | "pending" | "failed" | "canceled" | "inprocess" | "onhold" | "partial" | "fulfilled";
  created: number; // Unix timestamp
  shipping: string;
  shipping_service_name: string;
}

const PRINTFUL_API_BASE = "https://api.printful.com";

export class PrintfulClient {
  private accessToken: string;
  private storeId?: string;
  private baseUrl: string;

  constructor(config: PrintfulConfig) {
    this.accessToken = config.accessToken;
    this.storeId = config.storeId;
    this.baseUrl = config.baseUrl || PRINTFUL_API_BASE;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };

    if (this.storeId) {
      headers["X-PF-Store-Id"] = this.storeId;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Printful API error: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as { result: T };
    return data.result;
  }

  /**
   * 商品カタログを取得
   */
  async getProducts(): Promise<unknown> {
    return this.request("GET", "/products");
  }

  /**
   * 商品バリアント（サイズ・色）を取得
   */
  async getProductVariants(productId: number): Promise<unknown> {
    return this.request("GET", `/products/${productId}`);
  }

  /**
   * 注文を作成
   */
  async createOrder(order: PrintfulOrderRequest): Promise<PrintfulOrderResponse> {
    return this.request<PrintfulOrderResponse>("POST", "/orders", order);
  }

  /**
   * 注文ステータスを取得
   */
  async getOrder(orderId: number): Promise<PrintfulOrderResponse> {
    return this.request<PrintfulOrderResponse>("GET", `/orders/${orderId}`);
  }

  /**
   * 注文をキャンセル
   */
  async cancelOrder(orderId: number): Promise<void> {
    await this.request("DELETE", `/orders/${orderId}`);
  }

  /**
   * 配送料を計算
   */
  async calculateShipping(params: {
    recipient: PrintfulRecipient;
    items: { variant_id: number; quantity: number }[];
  }): Promise<unknown> {
    return this.request("POST", "/shipping/rates", params);
  }

  /**
   * 国一覧を取得
   */
  async getCountries(): Promise<unknown> {
    return this.request("GET", "/countries");
  }
}

/**
 * 額装ポスターのVariant ID例（Printful）
 *
 * 注意: 実際のVariant IDはPrintful APIから取得する必要があります
 * 以下は参考用のプレースホルダーです
 *
 * Enhanced Matte Paper Framed Poster (Product ID: 1)
 * - サイズ・フレーム色によりVariant IDが異なる
 */
export const PRINTFUL_FRAMED_POSTER_PRODUCTS = {
  // これらは仮のIDです - 実際のIDはAPIで確認してください
  "10x10_BLACK": 1234,
  "12x12_BLACK": 1235,
  "12x16_BLACK": 1236,
  "12x18_BLACK": 1237,
  "16x16_BLACK": 1238,
  "18x24_BLACK": 1239,
  "24x36_BLACK": 1240,
} as const;

/**
 * 日本発送時の注意点
 *
 * - Printfulは日本拠点あり（配送が速い）
 * - 一部商品（スマホケース等）は日本発送不可
 * - 額装ポスターは日本発送可能
 * - 送料は別途API（/shipping/rates）で計算
 */
