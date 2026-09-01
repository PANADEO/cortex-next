import { policyFor } from "@cortex/desk-core/capability-gate"
import { departmentLabel } from "@cortex/desk-core/capability-text"
import { identity } from "@cortex/desk-core/identity"
import { everyone } from "@cortex/desk-core/people"
import { Icon } from "@cortex/desk-ui/components/icon"
import { Avatar, Persona } from "@cortex/desk-ui/components/persona-switcher"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { HUB, MOUNTED_IN_SHELL, t } from "@cortex/desk-ui/routes"
import { ChevronRight, LayoutGrid, ListChecks } from "lucide-react"
import Link from "next/link"

/** Zakładka „Ja" istnieje po to, żeby na telefonie było gdzie trzymać rzeczy sprzed sprawy. */
export default async function Page() {
  const { user: u, switchable } = await identity()
  const p = await policyFor(u)
  const translate = await deskT()
  return (
    <Shell>
      <div className="h-full overflow-y-auto pb-desk-bar">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="flex items-center gap-3">
            <Avatar u={u} px={48} />
            <div>
              <div className="t-h2">
                {u.firstName} {u.lastName}
              </div>
              <div className="t-meta">{departmentLabel(translate, u.department)}</div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border bg-desk-surface">
            <Link
              href={t("/capabilities")}
              className="flex h-desk-row items-center gap-2.5 px-4 hover:bg-desk-raised/60"
            >
              <Icon as={ListChecks} px={16} className="text-desk-muted" />
              <span className="t-body flex-1">{translate("capabilities.title")}</span>
              <span className="t-meta tabular-nums">
                {translate("capabilities.ratio", {
                  granted: p.granted.length,
                  total: p.granted.length + p.blocked.length,
                })}
              </span>
              <Icon as={ChevronRight} px={16} className="text-desk-muted" />
            </Link>

            {/* Na telefonie kolumna po lewej jest schowana, więc to jedyne miejsce,
                z którego da się wrócić do katalogu aplikacji. */}
            {MOUNTED_IN_SHELL && (
              <Link
                href={HUB}
                className="flex h-desk-row items-center gap-2.5 border-t px-4 hover:bg-desk-raised/60"
              >
                <Icon as={LayoutGrid} px={16} className="text-desk-muted" />
                <span className="t-body flex-1">{translate("shell.hub")}</span>
                <Icon as={ChevronRight} px={16} className="text-desk-muted" />
              </Link>
            )}
          </div>

          {switchable && (
            <div className="mt-6 rounded-lg border bg-desk-surface p-3">
              <Persona me={u} everyone={await everyone()} />
            </div>
          )}

          <p className="t-micro mt-6">{translate("shell.privacy")}</p>
        </div>
      </div>
    </Shell>
  )
}
