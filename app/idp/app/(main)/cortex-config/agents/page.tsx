"use client"

import { AgentsPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function CortexConfigAgentsPage() {
  const { t } = useTranslation("cortex-config")
  return (
    <>
      <PageHeader title="AGENTS.md" description={t("pages.agents.description")} />
      <div className="p-6 pt-4">
        <AgentsPanel />
      </div>
    </>
  )
}
