// Builds the full logout chain URL: oauth2-proxy → Auth0 → frontend login.
//
// Why a chain: the deployed app sits behind oauth2-proxy which injects
// X-Auth-Request-Email. Clearing only the NextAuth cookie isn't enough —
// the next request still carries that header and NextAuth's authorize()
// re-creates the session. We must also clear the proxy cookie, and to
// avoid Auth0's SSO silently re-authenticating, we clear Auth0's cookie too.
//
// Returns null when Auth0 env vars are missing (local dev). Callers should
// then fall back to plain NextAuth signOut().

interface LogoutEnv {
  domain: string | undefined
  clientId: string | undefined
}

function readLogoutEnv(): LogoutEnv {
  return {
    domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN?.trim() || undefined,
    clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID?.trim() || undefined,
  }
}

export function buildAuth0LogoutUrl(returnTo: string, env: LogoutEnv = readLogoutEnv()): string | null {
  if (!env.domain || !env.clientId) return null
  const params = new URLSearchParams({ client_id: env.clientId, returnTo })
  return `https://${env.domain}/v2/logout?${params.toString()}`
}

export function buildLogoutChainUrl(returnTo: string, env: LogoutEnv = readLogoutEnv()): string | null {
  const auth0Url = buildAuth0LogoutUrl(returnTo, env)
  if (!auth0Url) return null
  return `/oauth2/sign_out?rd=${encodeURIComponent(auth0Url)}`
}
