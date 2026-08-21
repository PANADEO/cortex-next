"use client"

// Ustawienia (design doc §4.4) — formularz sam w sobie żyje w
// features/geo-score-calculator/components/settings-form.tsx (react-hook-
// form + Zod, wzorem ConnectorForm w cortex-config), ten plik tylko
// zarządza stanami ładowania/błędu zapytania o config i renderuje formularz
// dopiero, gdy config faktycznie już jest — dokładnie wzorem
// invoice-supervisor/settings/page.tsx (SchedulerForm mountowany dopiero po
// isLoading===false, więc lokalny stan formularza może być inicjalizowany
// leniwie wprost z serwera, bez efektu "re-sync").

import { GeoScoreSettingsForm } from "@/features/geo-score-calculator/components/settings-form"
import { useGeoScoreConfig } from "@/features/geo-score-calculator/hooks"
import { ErrorState, LoadingState, PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function GeoScoreCalculatorSettingsPage() {
  const { t } = useTranslation("geo-score-calculator")
  const configQuery = useGeoScoreConfig()

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {configQuery.isLoading ? (
          <LoadingState variant="skeleton" rows={6} />
        ) : configQuery.isError || !configQuery.data ? (
          <ErrorState
            title={t("settings.loadErrorTitle")}
            message={t("settings.loadErrorMessage")}
          />
        ) : (
          <GeoScoreSettingsForm config={configQuery.data} />
        )}
      </div>
    </>
  )
}
