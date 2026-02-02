/**
 * Admin Routes
 *
 * Phase 4: Manual fulfillment management
 * - GET /api/admin/orders - List orders with filtering
 * - GET /api/admin/orders/:id - Get single order details
 * - PATCH /api/admin/orders/:id - Update order status
 */

import type { Env } from "../index";
import { json } from "../util/http";
import { verifyAdminToken } from "../util/auth";

// Valid order statuses
const ORDER_STATUSES = ["DRAFT", "PAID", "SUBMITTED", "SHIPPED", "CANCELED", "FAILED"] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

interface OrderRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  artwork_id: string;
  stripe_session_id: string | null;
  customer_email: string | null;
  shipping_json: string | null;
  pod_provider: string | null;
  pod_order_id: string | null;
  last_error: string | null;
}

interface ArtworkRow {
  id: string;
  created_at: string;
  snapshot_id: string;
  kind: string;
  r2_key: string;
  mime: string;
  width_mm: number;
  height_mm: number;
}

/**
 * GET /api/admin/orders
 *
 * Query params:
 * - status: Filter by status (DRAFT, PAID, SUBMITTED, SHIPPED, CANCELED, FAILED)
 * - limit: Max results (default 50, max 200)
 * - offset: Pagination offset
 */
export async function listOrders(request: Request, env: Env): Promise<Response> {
  // Verify admin token
  const authError = verifyAdminToken(request, env.ADMIN_TOKEN);
  if (authError) return authError;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  // Validate status filter
  if (statusFilter && !ORDER_STATUSES.includes(statusFilter as OrderStatus)) {
    return json({
      ok: false,
      error: "invalid_status",
      message: `Invalid status. Valid values: ${ORDER_STATUSES.join(", ")}`,
    }, 400);
  }

  try {
    let query = "SELECT * FROM orders";
    const params: (string | number)[] = [];

    if (statusFilter) {
      query += " WHERE status = ?1";
      params.push(statusFilter);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    query += " OFFSET ?";
    params.push(offset);

    // Build parameterized query
    let stmt = env.DB.prepare(query);
    for (let i = 0; i < params.length; i++) {
      stmt = stmt.bind(params[i]);
    }

    const { results } = await stmt.all<OrderRow>();

    // Get total count
    let countQuery = "SELECT COUNT(*) as count FROM orders";
    if (statusFilter) {
      countQuery += " WHERE status = ?1";
    }
    const countResult = await (statusFilter
      ? env.DB.prepare(countQuery).bind(statusFilter)
      : env.DB.prepare(countQuery)
    ).first<{ count: number }>();

    return json({
      ok: true,
      orders: results || [],
      pagination: {
        total: countResult?.count || 0,
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error("listOrders error:", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}

/**
 * GET /api/admin/orders/:id
 *
 * Returns order details with associated artwork info
 */
export async function getOrder(request: Request, env: Env, orderId: string): Promise<Response> {
  // Verify admin token
  const authError = verifyAdminToken(request, env.ADMIN_TOKEN);
  if (authError) return authError;

  try {
    const order = await env.DB
      .prepare("SELECT * FROM orders WHERE id = ?1")
      .bind(orderId)
      .first<OrderRow>();

    if (!order) {
      return json({ ok: false, error: "not_found", message: "Order not found" }, 404);
    }

    // Get associated artwork
    const artwork = await env.DB
      .prepare("SELECT * FROM artworks WHERE id = ?1")
      .bind(order.artwork_id)
      .first<ArtworkRow>();

    // Parse shipping JSON if present
    let shipping = null;
    if (order.shipping_json) {
      try {
        shipping = JSON.parse(order.shipping_json);
      } catch {
        // Ignore parse errors
      }
    }

    return json({
      ok: true,
      order: {
        ...order,
        shipping,
        shipping_json: undefined, // Remove raw JSON
      },
      artwork: artwork || null,
      artworkUrl: artwork ? `/art/${artwork.r2_key}` : null,
    });
  } catch (err) {
    console.error("getOrder error:", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}

/**
 * PATCH /api/admin/orders/:id
 *
 * Update order status and metadata
 *
 * Body:
 * - status: New status
 * - pod_provider: POD provider used (gelato, printful, manual)
 * - pod_order_id: External order ID from POD
 * - last_error: Error message if failed
 */
export async function updateOrder(request: Request, env: Env, orderId: string): Promise<Response> {
  // Verify admin token
  const authError = verifyAdminToken(request, env.ADMIN_TOKEN);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => null) as {
      status?: string;
      pod_provider?: string;
      pod_order_id?: string;
      last_error?: string;
    } | null;

    if (!body) {
      return json({ ok: false, error: "invalid_body", message: "Invalid JSON body" }, 400);
    }

    // Check if order exists
    const existing = await env.DB
      .prepare("SELECT id, status FROM orders WHERE id = ?1")
      .bind(orderId)
      .first<{ id: string; status: string }>();

    if (!existing) {
      return json({ ok: false, error: "not_found", message: "Order not found" }, 404);
    }

    // Validate status if provided
    if (body.status && !ORDER_STATUSES.includes(body.status as OrderStatus)) {
      return json({
        ok: false,
        error: "invalid_status",
        message: `Invalid status. Valid values: ${ORDER_STATUSES.join(", ")}`,
      }, 400);
    }

    // Build update query
    const updates: string[] = [];
    const params: (string | null)[] = [];
    let paramIndex = 1;

    if (body.status) {
      updates.push(`status = ?${paramIndex++}`);
      params.push(body.status);
    }

    if (body.pod_provider !== undefined) {
      updates.push(`pod_provider = ?${paramIndex++}`);
      params.push(body.pod_provider || null);
    }

    if (body.pod_order_id !== undefined) {
      updates.push(`pod_order_id = ?${paramIndex++}`);
      params.push(body.pod_order_id || null);
    }

    if (body.last_error !== undefined) {
      updates.push(`last_error = ?${paramIndex++}`);
      params.push(body.last_error || null);
    }

    if (updates.length === 0) {
      return json({ ok: false, error: "no_updates", message: "No fields to update" }, 400);
    }

    // Add updated_at
    updates.push(`updated_at = ?${paramIndex++}`);
    params.push(new Date().toISOString());

    // Add order ID for WHERE clause
    params.push(orderId);

    const query = `UPDATE orders SET ${updates.join(", ")} WHERE id = ?${paramIndex}`;

    let stmt = env.DB.prepare(query);
    for (let i = 0; i < params.length; i++) {
      stmt = stmt.bind(params[i]);
    }
    await stmt.run();

    // Return updated order
    const updated = await env.DB
      .prepare("SELECT * FROM orders WHERE id = ?1")
      .bind(orderId)
      .first<OrderRow>();

    return json({
      ok: true,
      order: updated,
      previousStatus: existing.status,
    });
  } catch (err) {
    console.error("updateOrder error:", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}

/**
 * GET /api/admin/stats
 *
 * Get order statistics
 */
export async function getStats(request: Request, env: Env): Promise<Response> {
  // Verify admin token
  const authError = verifyAdminToken(request, env.ADMIN_TOKEN);
  if (authError) return authError;

  try {
    const stats = await env.DB
      .prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM orders
        GROUP BY status
      `)
      .all<{ status: string; count: number }>();

    const byStatus: Record<string, number> = {};
    let total = 0;

    for (const row of stats.results || []) {
      byStatus[row.status] = row.count;
      total += row.count;
    }

    return json({
      ok: true,
      stats: {
        total,
        byStatus,
      },
    });
  } catch (err) {
    console.error("getStats error:", err);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}
