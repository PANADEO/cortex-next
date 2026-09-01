import { Eksplorator } from "@cortex/desk-ui/components/eksplorator"
import { Powloka } from "@cortex/desk-ui/components/powloka"
import { Suspense } from "react"

export default async function Strona() {
  return (
    <Powloka>
      <div className="h-full overflow-y-auto">
        <Suspense>
          <Eksplorator />
        </Suspense>
      </div>
    </Powloka>
  )
}
