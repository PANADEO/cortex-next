"use client"

import { GovernancePanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function CortexConfigGovernancePage() {
  const { t } = useTranslation("cortex-config")
  return (
    <>
      <PageHeader
        title={t("pages.governance.title")}
        description={t("pages.governance.description")}
      />
      <div className="p-6 pt-4">
        <GovernancePanel />
      </div>
    </>
  )
}
