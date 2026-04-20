import "@cortex/styles/globals.css"

import type { Metadata } from "next"
import { Inter } from "next/font/google"
import type { ReactNode } from "react"
import { RootErrorBoundary } from "../components/error-boundaries"
import { AppProviders } from "../components/providers/app-providers"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Cortex",
  description: "Cortex Platform — IDP",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <RootErrorBoundary>
          <AppProviders>{children}</AppProviders>
        </RootErrorBoundary>
      </body>
    </html>
  )
}
