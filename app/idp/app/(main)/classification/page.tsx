"use client"

import { EmptyState, PageHeader } from "@cortex/ui"
import { FileSpreadsheet } from "lucide-react"

export default function ClassificationPage() {
  return (
    <>
      <PageHeader
        title="Classification"
        description="AI-assisted document classification with drag-and-drop grouping."
      />
      <div className="flex flex-1 items-start justify-center px-8 py-12">
        <EmptyState
          icon={FileSpreadsheet}
          title="Classification coming soon"
          description="Drag documents into package groups. Confidence scores from Gemini. Manual override available."
          className="max-w-lg"
        />
      </div>
    </>
  )
}
