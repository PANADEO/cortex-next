import NextAuth, { type NextAuthConfig, type User } from "next-auth"
import Credentials from "next-auth/providers/credentials"

// ===== SWAP POINT #1 — fake user; replace with OIDC provider (e.g. Keycloak) =====
const FAKE_USER: User & { role: string; tileAccess: string[] } = {
  id: "demo-user-001",
  email: "demo@cortex.local",
  name: "Demo User",
  role: "admin",
  tileAccess: ["idp"],
}

const fakeCredentialsProvider = Credentials({
  id: "credentials",
  name: "Demo Login",
  credentials: {},
  authorize: async () => FAKE_USER,
})
// ===== END SWAP POINT #1 =====

const authSecret = process.env.AUTH_SECRET

export const authConfig = {
  ...(authSecret ? { secret: authSecret } : {}),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [fakeCredentialsProvider],
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
