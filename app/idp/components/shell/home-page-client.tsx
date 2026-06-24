"use client"

import { useMe } from "@cortex/api"
import type { TileHrefOverrides } from "@/lib/tiles"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { getAuthErrorMessage } from "@/lib/auth-error-message"
import { AppGate } from "./app-gate"
import { AuthedHome } from "./authed-home"
import { LandingHero } from "./landing-hero"

interface HomePageClientProps {
  tileHrefOverrides?: TileHrefOverrides | undefined
}

export function HomePageClient({ tileHrefOverrides }: HomePageClientProps) {
  return (
    <Suspense fallback={null}>
      <HomeShell tileHrefOverrides={tileHrefOverrides} />
    </Suspense>
  )
}

function HomeShell({ tileHrefOverrides }: HomePageClientProps) {
  const searchParams = useSearchParams()
  const authErrorMessage = getAuthErrorMessage(searchParams)

  if (authErrorMessage) return <LandingHero authErrorMessage={authErrorMessage} />

  return <HomeContent tileHrefOverrides={tileHrefOverrides} />
}

function HomeContent({ tileHrefOverrides }: HomePageClientProps) {
  const me = useMe()

  if (me.isPending) return null
  if (me.data) {
    return (
      <AppGate>
        <AuthedHome tileHrefOverrides={tileHrefOverrides} />
      </AppGate>
    )
  }
  return <LandingHero />
}
