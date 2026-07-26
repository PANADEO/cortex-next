import "@cortex/styles/globals.css"

import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Inter } from "next/font/google"
import type { ReactNode } from "react"
import { RootErrorBoundary } from "../components/error-boundaries"
import { AppProviders } from "../components/providers/app-providers"

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ibmPlexMono.variable} ${ibmPlexSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        <RootErrorBoundary>
          <AppProviders>{children}</AppProviders>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
