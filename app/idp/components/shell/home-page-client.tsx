"use client"

import { useMe } from "@cortex/api"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { getAuthErrorMessage } from "@/lib/auth-error-message"
import { AppGate } from "./app-gate"
import { AuthedHome } from "./authed-home"
import { LandingHero } from "./landing-hero"

export function HomePageClient() {
  return (
    <Suspense fallback={null}>
      <HomeShell />
    </Suspense>
  )
}

function HomeShell() {
  const searchParams = useSearchParams()
  const authErrorMessage = getAuthErrorMessage(searchParams)

  if (authErrorMessage) return <LandingHero authErrorMessage={authErrorMessage} />

  return <HomeContent />
}

function HomeContent() {
  const me = useMe()

  if (me.isPending) return null
  if (me.data) {
    return (
      <AppGate>
        <AuthedHome />
      </AppGate>
    )
  }
  return <LandingHero />
}
