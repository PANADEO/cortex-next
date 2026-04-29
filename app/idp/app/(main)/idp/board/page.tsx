"use client"

import { PageHeader } from "@cortex/ui"
import { PipelineBoard } from "@/components/board/pipeline-board"

export default function BoardPage() {
  return (
    <>
      <PageHeader
        title="Pipeline board"
        description="Full journey of dirty and clean packages from intake to export."
      />
      <div className="flex flex-col px-8 py-6">
        <PipelineBoard />
      </div>
    </>
  )
}
