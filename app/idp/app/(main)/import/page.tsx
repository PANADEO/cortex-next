"use client"

import { PageHeader } from "@cortex/ui"
import { ImportQueue } from "@/components/import/import-queue"

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import"
        description="One unified drop zone — ZIP, loose files or whole folders. System auto-detects and starts processing."
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-8 py-6">
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How it works</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Drop a single <strong>ZIP</strong> → imported as-is.</li>
            <li>Drop several <strong>files or folders</strong> → zipped in the browser before upload.</li>
            <li>Each slot = one package. A new empty slot appears automatically under the last filled one.</li>
          </ul>
        </div>
        <ImportQueue />
      </div>
    </>
  )
}
