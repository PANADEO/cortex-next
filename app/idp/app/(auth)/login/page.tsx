"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const callbackUrl = useSearchParams()?.get("callbackUrl") ?? "/dashboard"
  const [isPending, setIsPending] = useState(false)

  async function handleDemoLogin() {
    setIsPending(true)
    // SWAP POINT #2 — replace "credentials" with real provider id (e.g. "keycloak").
    await signIn("credentials", { callbackUrl })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Cortex IDP</h1>
          <p className="text-sm text-muted-foreground">
            Prototype build — authenticate as the demo user.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isPending}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? "Signing in…" : "Continue as Demo User"}
        </button>
      </div>
    </main>
  )
}
