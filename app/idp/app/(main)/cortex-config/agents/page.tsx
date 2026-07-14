"use client"

import { AgentsPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"

export default function CortexConfigAgentsPage() {
  return (
    <>
      <PageHeader
        title="AGENTS.md"
        description="Hierarchiczne instrukcje agentów: organizacja → działy → kafelek → użytkownik. Warstwy admina edytujesz tutaj."
      />
      <div className="p-6 pt-4">
        <AgentsPanel />
      </div>
    </>
  )
}
