import { FileExplorer } from "@cortex/desk-ui/components/file-explorer"
import { Loading } from "@cortex/desk-ui/components/loading"
import { Shell } from "@cortex/desk-ui/components/shell"
import { Suspense } from "react"

export default async function Page() {
  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <Suspense fallback={<Loading rows={6} />}>
          <FileExplorer />
        </Suspense>
      </div>
    </Shell>
  )
}
