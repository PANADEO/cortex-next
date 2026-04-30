"use client"

import { Button } from "@cortex/ui"
import Image from "next/image"
import { DotGrid } from "./dot-grid"

export function LandingHero() {
  const handleSignIn = () => {
    const rd = `${window.location.origin}/`
    window.location.assign(`/oauth2/start?rd=${encodeURIComponent(rd)}`)
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <DotGrid animate />
      <header className="relative flex items-center gap-2.5 px-6 py-5">
        <Image
          src="/cortex-logo.png"
          alt="Cortex360"
          width={28}
          height={28}
          className="dark:invert dark:hue-rotate-180"
          priority
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Cortex360</span>
          <span className="text-[10px] text-muted-foreground">Forsped Sp. z o.o.</span>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight md:text-7xl">Cortex360</h1>
          <p className="text-xl font-medium text-foreground/80 md:text-2xl">
            Enterprise AI Hub
          </p>
          <p className="mx-auto max-w-md text-base text-muted-foreground">
            Zintegrowane moduły AI dla Twoich procesów biznesowych — od ekstrakcji
            dokumentów po automatyzację operacji.
          </p>
          <div className="pt-4">
            <Button
              size="lg"
              onClick={handleSignIn}
              className="bg-cortex px-8 text-base text-white shadow-lg shadow-cortex/30 hover:bg-cortex-dark"
            >
              Zaloguj się
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
