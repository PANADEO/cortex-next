import { policyFor } from "@cortex/desk-core/capability-gate"
import { departmentLabel } from "@cortex/desk-core/capability-text"
import { viewer } from "@cortex/desk-core/identity"
import { CapabilityList } from "@cortex/desk-ui/components/capability-list"
import { OtherRequest } from "@cortex/desk-ui/components/other-request"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskT } from "@cortex/desk-ui/i18n/server"

export default async function Page() {
  const u = await viewer()
  const p = await policyFor(u)
  const translate = await deskT()
  return (
    <Shell>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <h1 className="t-display">{translate("capabilities.title")}</h1>
          <p className="t-body mt-1 text-desk-muted">
            {translate("capabilities.lead", {
              department: departmentLabel(translate, u.department),
            })}
          </p>
          <div className="mt-6 rounded-lg border bg-desk-surface p-4">
            <CapabilityList p={p} search />
          </div>
          <div className="mt-4">
            <OtherRequest />
          </div>
          <p className="t-micro mt-4">{translate("capabilities.note")}</p>
        </div>
      </div>
    </Shell>
  )
}
