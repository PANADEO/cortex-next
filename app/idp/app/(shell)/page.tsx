"use client"

import { AppGate } from "@/components/shell/app-gate"
import { AuthedHome } from "@/components/shell/authed-home"
import { LandingHero } from "@/components/shell/landing-hero"
import { getAuthErrorMessage } from "@/lib/auth-error-message"
import { useMe } from "@cortex/api"
import { useSearchParams } from "next/navigation"

export default function HomePage() {
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
