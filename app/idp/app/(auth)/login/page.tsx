"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

function AutoSignIn() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const error = searchParams.get("error")

  useEffect(() => {
    if (error) return
    void signIn("credentials", { callbackUrl, redirect: true })
  }, [callbackUrl, error])

  if (error) {
    return (
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Authentication unavailable</h2>
        <p className="text-sm text-muted-foreground">
          We could not verify your session. Please contact your administrator.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Signing in…</p>
      <p className="text-xs text-muted-foreground">Connecting to your session</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Cortex IDP</h1>
          <p className="text-sm text-muted-foreground">
            Authenticating against your identity provider…
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <AutoSignIn />
        </Suspense>
      </div>
    </main>
  )
}
