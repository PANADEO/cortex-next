import "@cortex/styles/globals.css"

import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Inter } from "next/font/google"
import type { ReactNode } from "react"
import { RootErrorBoundary } from "../components/error-boundaries"
import { AppProviders } from "../components/providers/app-providers"
import { readInstancePreset } from "../lib/presets/instance-preset.server"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
})

// Oba warianty IBM Plex rejestrowane tu, a nie dopiero razem ze skinem, który
// ich użyje: `next/font` generuje nazwę zmiennej CSS w czasie builda i wpina ją
// w <html>, więc skin ładowany runtime'owo nie ma jak jej dołożyć —
// `var(--font-ibm-plex-sans)` bez tej rejestracji rozwija się w nic i font po
// cichu zjeżdża do domyślnego.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Cortex",
  description: "Cortex Platform — IDP",
}

/**
 * WYMÓG, NIE OPTYMALIZACJA (§5e). Bez tego Next próbuje prerenderować strony w
 * czasie builda — a build (także ten w Dockerze) nie ma `DATABASE_URL`, więc
 * odczyt presetu instancji zwróciłby „nieustawiony" i ta odpowiedź ZAPIEKŁABY
 * SIĘ w statycznym HTML-u. Instancja z ustawionym wyglądem nigdy by go nie
 * zobaczyła. Sam build NIE jest przy tym cichy — wypisuje błąd odczytu raz na
 * każdą prerenderowaną stronę — ale kończy się zerem, więc daje ZIELONY BUILD
 * ZE ZŁYM ARTEFAKTEM; cisza zaczyna się dopiero w runtime, gdzie nic już nie
 * wskazuje na przyczynę. Preset instancji jest z definicji wartością per
 * żądanie, więc korzeń dokumentu jest dynamiczny.
 *
 * Koszt przyjęty świadomie: wszystkie strony stają się renderowane na żądanie.
 * Dla tej aplikacji to niewiele — całość jest `"use client"`, więc prerender i
 * tak dawał samą skorupę bez danych, a każdy ekran i tak czeka na własne
 * zapytanie.
 */
export const dynamic = "force-dynamic"

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Preset instancji wchodzi do PIERWSZEGO renderu dwiema drogami naraz, i obie
  // są potrzebne: klasa skinu w `<html>` maluje kolory bez mignięcia, a ten sam
  // identyfikator podany propsem sprawia, że `usePreset()` zna odpowiedź w
  // pierwszym renderze Reacta i hub nie przeskakuje między layoutami.
  const instancePreset = await readInstancePreset()

  // Lista klas składana z filtrem, a nie szablonem: przy braku presetu instancji
  // ma wyjść napis IDENTYCZNY co do bajtu z tym sprzed E5 — `${a} ${b} ${c} ${d}`
  // zostawiłoby spację na końcu.
  const htmlClassName = [
    inter.variable,
    ibmPlexMono.variable,
    ibmPlexSans.variable,
    instancePreset.skinClass,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <html
      lang="en"
      className={htmlClassName}
      // Atrybut pojawia się TYLKO gdy instancja coś narzuca. Wypisywanie
      // `data-preset="neutral"` dla instancji bez ustawienia byłoby zgadywaniem
      // za użytkownika: jego wybór z `localStorage` serwer widzi dopiero po
      // hydratacji, więc atrybut i tak ustawia `theme-provider`.
      {...(instancePreset.id ? { "data-preset": instancePreset.id } : {})}
      suppressHydrationWarning
    >
      <body>
        <RootErrorBoundary>
          <AppProviders instancePreset={instancePreset.id}>{children}</AppProviders>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
