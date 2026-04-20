"use client"

import { ApiProvider } from "@cortex/api"
import { SessionProvider } from "next-auth/react"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { MswProvider } from "../../mocks/msw-provider"
import { AuthSync } from "./auth-sync"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MswProvider>
      <SessionProvider refetchOnWindowFocus={false}>
        <AuthSync />
        <ApiProvider devtools={process.env.NODE_ENV === "development"}>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ApiProvider>
      </SessionProvider>
    </MswProvider>
  )
}
