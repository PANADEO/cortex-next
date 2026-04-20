"use client"

import { EmptyState, PageHeader } from "@cortex/ui"
import { ScrollText } from "lucide-react"

export default function RulesPage() {
  return (
    <>
      <PageHeader
        title="Rule editor"
        description="Cost allocation rules driven by CN code, origin country, and weight."
      />
      <div className="flex flex-1 items-start justify-center px-8 py-12">
        <EmptyState
          icon={ScrollText}
          title="Rule editor coming soon"
          description="DSL-backed rules with live preview on sample invoices. Reusable across packages."
          className="max-w-lg"
        />
      </div>
    </>
  )
}
