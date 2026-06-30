// SECURITY: This handler trusts the `x-auth-request-email` header. It MUST run
// behind oauth2-proxy / Caddy `forward_auth`, which strips any client-supplied
// value and re-injects the authenticated email. Exposing this route directly to
// the public internet would let anyone forge identity by setting the header.
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getAccessResult, getRequestEmail } from "../../_lib/access"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = getRequestEmail(request.headers)

  if (!email) {
    return NextResponse.json({ error: "missing-email" }, { status: 401 })
  }

  return NextResponse.json(await getAccessResult(email))
}
