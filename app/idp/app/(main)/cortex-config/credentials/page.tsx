"use client"

import { CredentialsPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"

export default function CortexConfigCredentialsPage() {
  return (
    <>
      <PageHeader
        title="Sekrety"
        description="Credential store: drzewo key/subkey per departament. Wartości write-only - konsumowane przez referencje w konektorach i modelach."
      />
      <div className="p-6 pt-4">
        <CredentialsPanel />
      </div>
    </>
  )
}
