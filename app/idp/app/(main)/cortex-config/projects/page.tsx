"use client"

import { ProjectsPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"

export default function CortexConfigProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projekty agentowe"
        description="Kafelki task-chat konfigurowane centralnie: model, skille per rola, sandbox i export artefaktów."
      />
      <div className="p-6 pt-4">
        <ProjectsPanel />
      </div>
    </>
  )
}
