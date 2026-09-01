import { MemoryList } from "@cortex/desk-ui/components/memory-list"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { Suspense } from "react"

export default async function Page() {
  const translate = await deskT()
  return (
    <Shell>
      <div className="h-full overflow-y-auto pb-desk-bar md:pb-0">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <h1 className="t-display">{translate("memory.title")}</h1>
          <p className="t-body mt-1 text-desk-muted">{translate("memory.lead")}</p>
          <div className="mt-6">
            <Suspense>
              <MemoryList />
            </Suspense>
          </div>
        </div>
      </div>
    </Shell>
  )
}
