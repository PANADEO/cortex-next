"use client"

import { CredentialsPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function CortexConfigCredentialsPage() {
  const { t } = useTranslation("cortex-config")
  return (
    <>
      <PageHeader
        title={t("pages.credentials.title")}
        description={t("pages.credentials.description")}
      />
      <div className="p-6 pt-4">
        <CredentialsPanel />
      </div>
    </>
  )
}
