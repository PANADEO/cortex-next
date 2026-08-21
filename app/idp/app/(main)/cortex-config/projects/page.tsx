"use client"

import { ProjectsPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function CortexConfigProjectsPage() {
  const { t } = useTranslation("cortex-config")
  return (
    <>
      <PageHeader title={t("pages.projects.title")} description={t("pages.projects.description")} />
      <div className="p-6 pt-4">
        <ProjectsPanel />
      </div>
    </>
  )
}
