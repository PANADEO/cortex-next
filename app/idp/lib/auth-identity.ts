// Pure helpers for mapping oauth2-proxy headers → NextAuth user identity fields.
// Extracted from auth.ts so they can be unit-tested without pulling in next-auth's
// server-only modules (which fail to resolve in the Vitest module environment).

export function formatName(email: string): string {
  const local = email.split("@")[0] ?? email
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join(" ")
}

// Defensive filter: catches `auth0|...`, `google-oauth2|...`, `oidc|...` and similar
// `provider|id` shapes that some IdP/proxy configs leak into preferred_username.
const PROVIDER_SUB_PATTERN = /^[a-z0-9_-]+\|/i

export function resolveDisplayName(preferredUsername: string | null, email: string): string {
  const trimmed = preferredUsername?.trim() ?? ""
  if (trimmed && !PROVIDER_SUB_PATTERN.test(trimmed)) return trimmed
  return formatName(email)
}

export function resolveUserId(authRequestUser: string | null, email: string): string {
  return authRequestUser?.trim() || email
}
