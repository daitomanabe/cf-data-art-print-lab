/**
 * Admin Authentication Utility
 *
 * Simple Bearer token authentication for admin endpoints.
 * Token is set via ADMIN_TOKEN environment variable.
 */

import { json } from "./http";

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Verify admin token
 * Returns null if valid, or an error Response if invalid
 */
export function verifyAdminToken(
  request: Request,
  adminToken: string | undefined
): Response | null {
  // If ADMIN_TOKEN is not configured, admin API is disabled
  if (!adminToken) {
    return json(
      { ok: false, error: "admin_api_disabled", message: "ADMIN_TOKEN not configured" },
      503
    );
  }

  const token = extractBearerToken(request);

  if (!token) {
    return json(
      { ok: false, error: "unauthorized", message: "Missing Authorization header" },
      401
    );
  }

  // Constant-time comparison to prevent timing attacks
  if (!secureCompare(token, adminToken)) {
    return json(
      { ok: false, error: "forbidden", message: "Invalid token" },
      403
    );
  }

  return null; // Valid
}

/**
 * Constant-time string comparison
 * Prevents timing attacks on token verification
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
