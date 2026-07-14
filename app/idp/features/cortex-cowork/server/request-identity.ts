import type { NextRequest } from "next/server"

/**
 * Authenticated user email for a cowork route. Same trust model as
 * app/api/me/access: the `x-auth-request-email` header is injected by
 * oauth2-proxy at the edge (client-supplied values are stripped there), with
 * a DEV_USER_EMAIL fallback outside production.
 */
export function requestEmail(request: NextRequest): string | undefined {
  const devFallback = process.env.NODE_ENV !== "production" ? process.env.DEV_USER_EMAIL : undefined
  return request.headers.get("x-auth-request-email") ?? devFallback ?? undefined
}
