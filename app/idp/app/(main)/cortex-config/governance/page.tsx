"use client"

import { CredentialsPanel, GovernancePanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"

export default function CortexConfigGovernancePage() {
  return (
    <>
      <PageHeader
        title="Role i uprawnienia"
        description="Centralne governance: grupy skilli, role, przypisania użytkowników i sekrety dla wszystkich projektów agentowych."
      />
      <div className="space-y-6 p-6 pt-4">
        <GovernancePanel />
        <CredentialsPanel />
      </div>
    </>
  )
}
