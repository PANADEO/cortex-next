"use client"

import { CatalogPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function CortexConfigCatalogPage() {
  const { t } = useTranslation("cortex-config")
  return (
    <>
      <PageHeader title={t("pages.catalog.title")} description={t("pages.catalog.description")} />
      <div className="p-6 pt-4">
        <CatalogPanel />
      </div>
    </>
  )
}
