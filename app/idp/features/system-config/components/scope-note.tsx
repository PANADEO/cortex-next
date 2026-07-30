"use client"

import { Alert, AlertDescription, AlertTitle } from "@cortex/ui"
import { Info } from "lucide-react"

/**
 * Notatka o rzeczywistym zasięgu modułu. Do 30.07.2026 ostrzegała, że moduł
 * gatuje wyłącznie sam siebie, a pozostałe kafelki pyta zewnętrzny
 * cortex-admin. Po unifikacji bramek jest odwrotnie: to jedyne źródło prawdy
 * o dostępie do wszystkiego — i to też trzeba powiedzieć wprost, bo zmienia
 * skutki każdego kliknięcia na tych ekranach.
 */
export function ScopeNote() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Zasięg tego modułu</AlertTitle>
      <AlertDescription>
        Role i uprawnienia ustawiane tutaj kontrolują dostęp do wszystkich kafelków instancji — hub
        i bramka powłoki czytają wyłącznie tę bazę. Odebranie uprawnienia działa natychmiast;
        widoczność kafelków w już otwartej przeglądarce może odświeżyć się do 30 sekund.
      </AlertDescription>
    </Alert>
  )
}
