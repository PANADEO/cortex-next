"use client"

import { ApiProvider } from "@cortex/api"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { MswProvider } from "../../mocks/msw-provider"
import { ThemeProvider } from "./theme-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MswProvider>
      <ApiProvider devtools={process.env.NODE_ENV === "development"}>
        <ThemeProvider />
        {children}
        <Toaster richColors closeButton position="top-right" />
      </ApiProvider>
    </MswProvider>
  )
}
