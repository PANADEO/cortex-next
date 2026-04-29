import NextAuth, { type NextAuthConfig, type User } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { resolveDisplayName, resolveUserId } from "./lib/auth-identity"

export { resolveDisplayName, resolveUserId } from "./lib/auth-identity"

// Identity contract: read X-Auth-Request-Email injected by oauth2-proxy in prod;
// fall back to DEV_AUTH_USER_EMAIL env for local dev; null → CredentialsSignin.
// See docs/backend-integration.md.
function readHeader(request: Request, name: string): string | null {
  const value = (request.headers.get(name) ?? "").trim()
  return value || null
}

const proxyCredentialsProvider = Credentials({
  id: "credentials",
  name: "Proxy",
  credentials: {},
  authorize: async (_credentials, request) => {
    const headerEmail = readHeader(request, "x-auth-request-email")
    const envEmail = (process.env.DEV_AUTH_USER_EMAIL ?? "").trim() || null
    const email = headerEmail ?? envEmail
    if (!email) return null

    const preferredUsername = readHeader(request, "x-auth-request-preferred-username")
    const authRequestUser = readHeader(request, "x-auth-request-user")
    const name = resolveDisplayName(preferredUsername, email)
    const id = resolveUserId(authRequestUser, email)

    return {
      id,
      email,
      name,
      role: "admin",
      tileAccess: ["idp"],
    } satisfies User & { role: "admin" | "operator" | "viewer"; tileAccess: string[] }
  },
})

const authSecret = process.env.AUTH_SECRET

export const authConfig = {
  ...(authSecret ? { secret: authSecret } : {}),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [proxyCredentialsProvider],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as User & { role: string; tileAccess: string[] }
        token.id = u.id as string
        if (u.email) token.email = u.email
        if (u.name) token.name = u.name
        token.role = u.role
        token.tileAccess = u.tileAccess
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as "admin" | "operator" | "viewer"
        session.user.tileAccess = token.tileAccess as string[]
      }
      return session
    },
    authorized: async ({ auth }) => !!auth,
  },
} satisfies NextAuthConfig

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
