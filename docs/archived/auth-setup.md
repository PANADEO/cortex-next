# Auth Setup — NextAuth v5 Blueprint for Cortex IDP

**Status:** Blueprint for prototype — fake user now, real OIDC/SSO later
**Stack:** Next.js 15 App Router + React 18, all components `"use client"`, no RSC, no Server Actions
**Author:** Cezary
**Date:** 2026-04-20

---

## Intent

Scaffold real NextAuth v5 architecture on day one, run it against a fake user for the prototype. When the enterprise customer demands Keycloak/OIDC, migration is a **~1-hour job of swapping one provider block**, not a refactor. Every swap point is marked `SWAP:` in code and listed in section 9.

---

## 1. Dependencies

NextAuth v5 is in **beta** under the Auth.js line. This is the correct version for Next.js 15 App Router — do not use v4 for new projects.

```bash
npm install next-auth@beta @auth/core@latest
```

Lock to current stable beta in `package.json`:

```json
{
  "dependencies": {
    "next-auth": "5.0.0-beta.29",
    "@auth/core": "^0.40.0"
  }
}
```

No new peer deps — `next`, `react`, `react-dom` are already in our stack.

`.env.local`:

```bash
AUTH_SECRET="<generate with: npx auth secret>"
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"   # Docker self-host, non-Vercel

# SWAP: real OIDC later (Keycloak example)
# AUTH_KEYCLOAK_ID=""
# AUTH_KEYCLOAK_SECRET=""
# AUTH_KEYCLOAK_ISSUER="https://idp.company.internal/realms/cortex"
```

---

## 2. Directory layout

Monorepo layout — `app/idp/` is the Next.js app, `libs/@cortex/api/` is the shared API layer shared across tiles.

```
/app/idp/
├── auth.ts                                  # NextAuth config (SWAP point #1)
├── middleware.ts                            # route protection
├── app/
│   ├── api/auth/[...nextauth]/route.ts      # NextAuth HTTP handlers
│   ├── (auth)/login/page.tsx                # custom login page
│   ├── (main)/                              # protected routes
│   └── layout.tsx                           # wraps SessionProvider
├── components/
│   └── providers/
│       ├── session-provider.tsx             # SessionProvider wrapper ("use client")
│       └── app-providers.tsx                # composes Session + QueryClient
└── types/
    └── next-auth.d.ts                       # module augmentation

/libs/@cortex/api/
├── client.ts                                # apiClient with auth header interceptor
└── auth-headers.ts                          # buildAuthHeaders(session) — SWAP point #5
```

`auth.ts` lives at the app root because `middleware.ts`, the `[...nextauth]` route, and the apiClient all import `auth`/`handlers` from it. `session-provider.tsx` is IDP-local for now — lift to `/libs/@cortex/api/providers/` when a second tile needs it.

---

## 3. `auth.ts` — Credentials provider (fake user)

Swap to OIDC by replacing the `providers: [...]` array. Callbacks, session, pages stay as-is.

```ts
// /app/idp/auth.ts
import NextAuth, { type NextAuthConfig, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// ===== SWAP POINT #1 — fake user; replace with OIDC provider (see §10) =====
const FAKE_USER: User & { role: string; tileAccess: string[] } = {
  id: "demo-user-001",
  email: "demo@cortex.local",
  name: "Demo User",
  role: "admin",
  tileAccess: ["idp"],
};

const fakeCredentialsProvider = Credentials({
  id: "credentials",
  name: "Demo Login",
  credentials: {},
  authorize: async () => FAKE_USER,
});
// ===== END SWAP POINT #1 =====

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8h, see §11
  pages: { signIn: "/login" },
  providers: [fakeCredentialsProvider],
  callbacks: {
    // `user` is what `authorize` returned (or OIDC profile on first sign-in).
    async jwt({ token, user }) {
      if (user) {
        const u = user as User & { role: string; tileAccess: string[] };
        token.id = u.id as string;
        token.email = u.email ?? undefined;
        token.name = u.name ?? undefined;
        token.role = u.role;
        token.tileAccess = u.tileAccess;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tileAccess = token.tileAccess as string[];
      }
      return session;
    },
    authorized: async ({ auth }) => !!auth,
  },
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
```

---

## 4. Module augmentation — `types/next-auth.d.ts`

Extends the default `Session`, `User`, and `JWT` types with Cortex-specific fields so `session.user.role` and `session.user.tileAccess` are strictly typed everywhere.

```ts
// /app/idp/types/next-auth.d.ts
import type { DefaultSession, DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

type CortexRole = "admin" | "operator" | "viewer";
type CortexTile = "idp" | (string & {}); // open union — more tiles later

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: CortexRole;
      tileAccess: CortexTile[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: CortexRole;
    tileAccess: CortexTile[];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: CortexRole;
    tileAccess: CortexTile[];
  }
}
```

Ensure `tsconfig.json` `include` covers `types/**/*.d.ts`.

---

## 5. Session provider wrapper

All components are `"use client"`, so we wrap the root layout with `SessionProvider` once and `useSession()` works everywhere. We do **not** pass a `session` prop — the provider fetches `/api/auth/session` on mount. This keeps the layout non-dynamic (no RSC server-fetch). Small extra round-trip; acceptable for a data-intensive SPA.

```tsx
// /app/idp/components/providers/session-provider.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
```

`app-providers.tsx` composes `AuthSessionProvider` + `QueryClientProvider` (QueryClient instantiated via `useState(() => new QueryClient())` so it's stable per mount). The root `layout.tsx` only renders `<AppProviders>{children}</AppProviders>` inside `<html><body>`.

Any component can now:

```tsx
"use client";
import { useSession } from "next-auth/react";
export function UserBadge() {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return null;
  return <span>{session.user.name} · {session.user.role}</span>;
}
```

---

## 6. Middleware — protected routes

Wraps `auth` and redirects unauthenticated users to `/login`, preserving `callbackUrl`.

> **Next.js 16 note:** Auth.js v5 docs mention a future `proxy.ts` rename. We're on Next 15 — `middleware.ts` is correct. On upgrade, rename and export as `proxy`.

```ts
// /app/idp/middleware.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));

  if (isPublic) {
    if (isLoggedIn && nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  // Exclude Next internals, static assets, and the auth API (else redirect loop).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
```

---

## 7. Route handler — `app/api/auth/[...nextauth]/route.ts`

Standard v5 one-liner — all HTTP traffic for NextAuth goes through here.

```ts
// /app/idp/app/api/auth/[...nextauth]/route.ts
export { GET, POST } from "@/auth";
```

---

## 8. Login page

Architecture forbids Server Actions, so we use client-side `signIn` from `next-auth/react`. Fully supported in v5 — the server-action pattern in Auth.js examples is optional.

```tsx
// /app/idp/app/(auth)/login/page.tsx
"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@cortex/ui/components/button";

export default function LoginPage() {
  const callbackUrl = useSearchParams().get("callbackUrl") ?? "/dashboard";
  const [isPending, setIsPending] = useState(false);

  async function handleDemoLogin() {
    setIsPending(true);
    // SWAP POINT #2 — replace "credentials" with real provider id ("keycloak").
    await signIn("credentials", { callbackUrl });
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8">
        <h1 className="text-xl font-semibold">Cortex IDP</h1>
        <p className="text-sm text-muted-foreground">
          Prototype build — authenticate as the demo user.
        </p>
        <Button className="w-full" onClick={handleDemoLogin} disabled={isPending}>
          {isPending ? "Signing in…" : "Continue as Demo User"}
        </Button>
      </div>
    </main>
  );
}
```

---

## 9. Integration with TanStack Query API client

The shared API layer in `/libs/@cortex/api/` reads the session and adds auth headers on every request. The IDP backend already understands `X-Auth-Request-Email` (auth-proxy convention — same as oauth2-proxy / Keycloak gatekeeper in the current Streamlit deployment). Replicating it keeps the backend contract identical.

```ts
// /libs/@cortex/api/auth-headers.ts
import type { Session } from "next-auth";

/**
 * Build auth headers for outgoing API calls to the IDP backend.
 *
 * SWAP POINT #3 — Today this reads from the NextAuth session.
 * In production behind an auth proxy (oauth2-proxy / Keycloak gatekeeper),
 * the proxy injects X-Auth-Request-* headers automatically at the edge,
 * and the browser doesn't need to set them — the request goes through
 * the proxy which adds headers server-side. At that point this function
 * returns {} and we rely entirely on cookies + proxy injection.
 */
export function buildAuthHeaders(session: Session | null): HeadersInit {
  if (!session?.user?.email) return {};
  return {
    "X-Auth-Request-Email": session.user.email,
    "X-Auth-Request-User": session.user.id,
    "X-Cortex-Tile": "idp",
  };
}
```

```ts
// /libs/@cortex/api/client.ts
import { getSession } from "next-auth/react";
import { buildAuthHeaders } from "./auth-headers";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/proxy";

export class ApiError extends Error {
  constructor(public status: number, public body: string) { super(`API ${status}: ${body}`); }
}

export async function apiClient<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  const session = await getSession(); // client-safe; reads /api/auth/session
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(session),
      ...init.headers,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as T;
}
```

Feature code (TanStack Query hooks per architecture_rules §5/§8) uses `apiClient` and sees nothing of auth. Swapping "read from session" → "read from proxy-injected header" only touches `buildAuthHeaders`.

---

## 10. Swap points summary

Migration from fake user to enterprise SSO is this list of edits — no feature code changes. Effort: **~1h + IdP realm config.**

| # | File | From | To |
|---|------|------|-----|
| 1 | `/app/idp/auth.ts` | `fakeCredentialsProvider` | OIDC provider (snippet below) |
| 2 | `/app/idp/app/(auth)/login/page.tsx` | `signIn("credentials")` | `signIn("keycloak")` — or delete page, let NextAuth redirect to IdP |
| 3 | `/libs/@cortex/api/auth-headers.ts` | Build headers from session | Return `{}` — proxy injects at edge |
| 4 | `.env.*` | No OIDC vars | `AUTH_KEYCLOAK_ID/SECRET/ISSUER` |
| 5 | `auth.ts` `jwt` callback | Hardcoded `role`/`tileAccess` | Read from `profile` (OIDC claims, realm roles, groups) |
| 6 | `next.config.ts` | — | Add IdP hostname to `images.remotePatterns` if avatars used |

**Drop-in for swap point #1 (Keycloak):**

```ts
import Keycloak from "next-auth/providers/keycloak";

const keycloakProvider = Keycloak({
  clientId: process.env.AUTH_KEYCLOAK_ID,
  clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
  issuer: process.env.AUTH_KEYCLOAK_ISSUER,
});

providers: [keycloakProvider],

async jwt({ token, user, profile }) {
  if (user && profile) {
    const p = profile as { sub?: string; realm_access?: { roles?: string[] }; groups?: string[] };
    token.id = p.sub ?? (user.id as string);
    token.email = profile.email as string;
    token.name = profile.name as string;
    const roles = p.realm_access?.roles ?? [];
    token.role = roles.includes("cortex-admin") ? "admin"
      : roles.includes("cortex-operator") ? "operator" : "viewer";
    token.tileAccess = (p.groups ?? [])
      .filter((g) => g.startsWith("/cortex/"))
      .map((g) => g.replace("/cortex/", ""));
  }
  return token;
},
```

---

## 11. Gotchas

### `"use client"` everywhere

- `useSession()`, `signIn()`, `signOut()` from `next-auth/react` — fine, they're client APIs.
- `auth()` helper (server-side session) — used **only** in `middleware.ts` and `route.ts`. Never in components.
- `getServerSession` (v4) is gone. V5 uses `auth()` server-side everywhere.
- No Server Actions → login page uses client-side `signIn`. Fully supported; the `"use server"` form-action pattern in Auth.js docs is optional.
- No RSC → no `session` prop to `SessionProvider`. Provider fetches `/api/auth/session` on mount. One extra round-trip, keeps layout non-dynamic.

### JWT vs database session

**Decision:** `strategy: "jwt"`, no adapter.

- Prototype: zero infra (no Postgres/Redis for sessions). Encrypted cookie, done. Identical in dev / Docker / behind proxy.
- Production: behind an enterprise auth proxy, the proxy owns session state. NextAuth's session becomes a cookie cache of IdP claims. DB sessions would just double-persist what Keycloak already persists. If server-side revocation is later needed, `@auth/prisma-adapter` is a non-breaking add.
- Trade-off: JWT can't revoke before expiry without a blocklist. `maxAge: 8h` caps blast radius; real IdP handles revocation on top.

### Cookies & proxy

- Default cookie: `authjs.session-token`. `SameSite=Lax` (default) is correct — OIDC redirects are top-level nav, Lax permits.
- **Do not** set `SameSite=Strict` — it breaks OIDC callback.
- Behind HTTPS reverse proxy: `AUTH_TRUST_HOST=true` required so Auth.js trusts `X-Forwarded-*`, otherwise callback URLs come out `http://` and OIDC fails.
- Docker: `AUTH_URL` must be the public URL users hit, not container-internal.

### Middleware matcher

- Must exclude `/api/auth` or you get an infinite redirect loop.
- Must exclude `_next/static`, `_next/image`, image extensions.
- Runs on every request — keep it tight, no DB calls. JWT decode is free.

### TypeScript & misc

- `types/next-auth.d.ts` must be `.d.ts` and in `tsconfig.json` `include`. If `session.user.role` shows as `unknown`, that's the cause.
- We export `authConfig` separately from `NextAuth(authConfig)` so later we can split into an edge-compatible subset when an adapter is added (adapters pull Node APIs that break the edge middleware runtime).
- `useSession()` triggers a network call on mount — gate UI on `status === "authenticated"`, not on `session` truthiness, to avoid a flash of logged-out content.
- Do not put session data into React Query cache. Separate lifecycles.
