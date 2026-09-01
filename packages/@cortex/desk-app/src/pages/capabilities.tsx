import { policyFor } from "@cortex/desk-core/capability-gate"
import { whoAmI } from "@cortex/desk-core/identity"
import { CapabilityList } from "@cortex/desk-ui/components/capability-list"
import { OtherRequest } from "@cortex/desk-ui/components/other-request"
import { Shell } from "@cortex/desk-ui/components/shell"

export default async function Page() {
  const u = await whoAmI()
  const p = await policyFor(u)
  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <h1 className="t-display">Co potrafię</h1>
          <p className="t-body mt-1 text-desk-muted">
            To jest wszystko, co mogę dla Ciebie zrobić w dziale {u.department}. Reszta wymaga zgody
            działu, który za nią odpowiada.
          </p>
          <div className="mt-6 rounded-lg border bg-desk-surface p-4">
            <CapabilityList p={p} search />
          </div>
          <div className="mt-4">
            <OtherRequest />
          </div>
          <p className="t-micro mt-4">
            Zdolność, której nie mam, nie jest przede mną schowana — po prostu jej u Ciebie nie ma.
            Nie da się mnie namówić na jej użycie.
          </p>
        </div>
      </div>
    </Shell>
  )
}
