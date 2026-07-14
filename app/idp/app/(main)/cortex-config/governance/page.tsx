"use client"

import { GovernancePanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"

export default function CortexConfigGovernancePage() {
  return (
    <>
      <PageHeader
        title="Role i uprawnienia"
        description="Centralne governance: grupy skilli, role i przypisania użytkowników dla wszystkich projektów agentowych."
      />
      <div className="p-6 pt-4">
        <GovernancePanel />
      </div>
    </>
  )
}
