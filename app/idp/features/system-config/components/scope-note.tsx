"use client"

import { Alert, AlertDescription, AlertTitle } from "@cortex/ui"
import { Info } from "lucide-react"

/**
 * Notatka o rzeczywistym zasięgu modułu. Bez niej ekrany sugerują, że to panel
 * uprawnień całej instancji — a dziś gatują wyłącznie ten moduł.
 */
export function ScopeNote() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Zasięg tego modułu</AlertTitle>
      <AlertDescription>
        Role i uprawnienia ustawiane tutaj kontrolują dziś wyłącznie dostęp do Konfiguracji Systemu.
        Pozostałe kafelki instancji (AI Tools, Intrastat, Cortex Cowork, Invoice Supervisor) nadal
        pytają o uprawnienia zewnętrzny cortex-admin.
      </AlertDescription>
    </Alert>
  )
}
