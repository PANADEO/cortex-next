"use client"

import { CatalogPanel } from "@/features/cortex-config"
import { PageHeader } from "@cortex/ui"

export default function CortexConfigCatalogPage() {
  return (
    <>
      <PageHeader
        title="Katalog zasobów"
        description="Departamentowe drzewo skilli, konektorów i sekretów - budowane centralnie, wybierane w projektach jako klocki."
      />
      <div className="p-6 pt-4">
        <CatalogPanel />
      </div>
    </>
  )
}
