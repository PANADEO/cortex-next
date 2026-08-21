"use client"

import { Alert, AlertDescription, AlertTitle } from "@cortex/ui"
import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * Jawna nota o jakości danych (projekt 1.4). NIE jest ozdobą i nie wolno jej
 * chować za rozwijanym panelem: raport nazywa się "Raportowanie Tokenów"
 * i bez tej informacji łatwo wziąć te liczby za rozliczenie co do tokena.
 *
 * Fakty pochodzą z kodu cortex-proxy:
 *  - `logMiddleware` wpisuje RequestTokens: countTokensFallback(body) — regexowe
 *    liczenie "słów". Prawdziwymi wartościami nadpisuje je dopiero blok `usage`
 *    z odpowiedzi dostawcy (proxy.go:512-528). Gdy dostawca go nie przysłał,
 *    w bazie zostaje szacunek.
 *  - Raport obejmuje CAŁY ruch przez proxy, nie tylko Cortex360 — proxy obsługuje
 *    kilkanaście repozytoriów, a wymiary source_app/scope wypełnia wołający.
 */
export function DataQualityNote() {
  const { t } = useTranslation("token-usage")

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>{t("dataQuality.title")}</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        <p>{t("dataQuality.estimates")}</p>
        <p>{t("dataQuality.coverage")}</p>
      </AlertDescription>
    </Alert>
  )
}
