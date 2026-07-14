"use client"

import { GovernancePanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"

export default function CortexConfigGovernancePage() {
  return (
    <>
      <PageHeader
        title="Role i dostęp"
        description="Role jako bramki dostępu, przypisania użytkowników i administratorzy panelu."
      />
      <div className="p-6 pt-4">
        <GovernancePanel />
      </div>
    </>
  )
}
