"use client"

import { useMe } from "@cortex/api"
import { AppGate } from "@/components/shell/app-gate"
import { AuthedHome } from "@/components/shell/authed-home"
import { LandingHero } from "@/components/shell/landing-hero"

export default function HomePage() {
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
