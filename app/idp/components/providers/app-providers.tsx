"use client"

import { ApiProvider } from "@cortex/api"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
// Import DLA EFEKTU UBOCZNEGO — inicjalizuje jedyną instancję i18next,
// zanim którykolwiek widok zawoła `useTranslation()`. Bez tego pierwszy
// render trafia na nieskonfigurowany i18next i pokazuje surowe klucze.
import "@/lib/i18n"
import { InstancePresetProvider } from "@/lib/presets/instance-preset"
import { MswProvider } from "../../mocks/msw-provider"
import { ThemeProvider } from "./theme-provider"

interface AppProvidersProps {
  children: ReactNode
  /** Z `app/idp/app/layout.tsx` (serwer). `null` = instancja nie narzuca
   *  wyglądu. Domyślne `null` trzyma przy życiu montowanie `AppProviders`
   *  bez tego propsu w testach i w Ladle. */
  instancePreset?: string | null
}

export function AppProviders({ children, instancePreset = null }: AppProvidersProps) {
  return (
    <InstancePresetProvider value={instancePreset}>
      <MswProvider>
        <ApiProvider devtools={process.env.NODE_ENV === "development"}>
          <ThemeProvider />
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ApiProvider>
      </MswProvider>
    </InstancePresetProvider>
  )
}
