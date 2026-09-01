import { policyFor } from "@cortex/desk-core/capability-gate"
import { USERS, whoAmI } from "@cortex/desk-core/identity"
import { Icon } from "@cortex/desk-ui/components/icon"
import { Avatar, Persona } from "@cortex/desk-ui/components/persona-switcher"
import { Shell } from "@cortex/desk-ui/components/shell"
import { t } from "@cortex/desk-ui/routes"
import { ChevronRight, ListChecks } from "lucide-react"
import Link from "next/link"

/** Zakładka „Ja" istnieje po to, żeby na telefonie było gdzie trzymać rzeczy sprzed sprawy. */
export default async function Page() {
  const u = await whoAmI()
  const p = await policyFor(u)
  return (
    <Shell>
      <div className="pb-pasek h-full overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="flex items-center gap-3">
            <Avatar u={u} px={48} />
            <div>
              <div className="t-h2">
                {u.firstName} {u.lastName}
              </div>
              <div className="t-meta">{u.department}</div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border bg-surface">
            <Link
              href={t("/capabilities")}
              className="flex h-wiersz items-center gap-2.5 px-4 hover:bg-raised/60"
            >
              <Icon as={ListChecks} px={16} className="text-cichy" />
              <span className="t-tresc flex-1">Co potrafię</span>
              <span className="t-meta">
                {p.granted.length} z {p.granted.length + p.blocked.length}
              </span>
              <Icon as={ChevronRight} px={16} className="text-cichy" />
            </Link>
          </div>

          <div className="mt-6 rounded-lg border bg-surface p-3">
            <Persona ja={u} everyone={USERS} />
          </div>

          <p className="t-micro mt-6">
            {
              "Pliki zostają na serwerze firmy. Do modelu trafia tylko ta treść, którą asystent musi przeczytać, żeby wykonać zlecenie."
            }
          </p>
        </div>
      </div>
    </Shell>
  )
}
