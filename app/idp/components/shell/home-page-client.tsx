"use client"

import { getAuthErrorMessage } from "@/lib/auth-error-message"
import type { TileHrefOverrides } from "@/lib/tiles"
import { useAuthorizedApps, useMe } from "@cortex/api"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { HubGate } from "./app-gate"
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
  const authorized = useAuthorizedApps()

  // Hub NIE czeka na /user/me. Bez backendu IDP to żądanie nie przynosi nic
  // użytecznego: na cortex-next rewrite leci na nieistniejący host `idp-app`,
  // więc `getaddrinfo ENOTFOUND` → 500 (szybki błąd), a host odpowiadający na
  // TCP, ale nie na HTTP, zostawiłby je wiszące bez końca. W obu trybach
  // oczekiwanie na nie zostawiało pustą stronę zamiast huba.
  if (authorized.isLoading) return null

  // "Czy ktokolwiek jest zalogowany" i "co mu wolno" to dwa różne pytania.
  // Tożsamość może potwierdzić DOWOLNE z dwóch źródeł: /api/me/access, które
  // zwraca e-mail z nagłówka wstrzykniętego przez oauth2-proxy (401, gdy nikt
  // się nie przedstawił), albo /user/me. Wcześniej liczyło się wyłącznie
  // /user/me, więc bez backendu IDP zalogowany użytkownik dostawał ekran
  // marketingowy zamiast swojego huba.
  const identified = Boolean(authorized.email) || Boolean(me.data)
  if (!identified) return <LandingHero />

  return (
    <HubGate>
      <AuthedHome tileHrefOverrides={tileHrefOverrides} />
    </HubGate>
  )
}
