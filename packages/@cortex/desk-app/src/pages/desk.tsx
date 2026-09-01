import { policyFor } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { countResults } from "@cortex/desk-core/folder-server"
import { whoAmI } from "@cortex/desk-core/identity"
import { CaseList, type CaseRow } from "@cortex/desk-ui/components/case-list"
import { Composer } from "@cortex/desk-ui/components/composer"
import { Shell } from "@cortex/desk-ui/components/shell"
import { t } from "@cortex/desk-ui/routes"
import Link from "next/link"
import { Suspense } from "react"

const ON_DESK = 12

export default async function Desk() {
  await migrate()
  const u = await whoAmI()
  const p = await policyFor(u)
  const s = await pool.query(
    `select id, title, status, reason, updated_at as "updatedAt" from desk.case_file where owner=$1 order by updated_at desc limit $2`,
    [u.id, ON_DESK],
  )

  const results = await countResults(
    u.id,
    s.rows.map((r) => r.id),
  )
  const cases: CaseRow[] = s.rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    reason: r.reason,
    updatedAt: r.updatedAt.toISOString(),
    documents: results.get(r.id) ?? 0,
  }))

  return (
    <Shell>
      <div className="pb-pasek h-full overflow-y-auto md:pb-0">
        <div className="mx-auto max-w-strumien px-5 py-8 md:py-10">
          {/* Powitanie zostaje na stałe — „nikt inny go nie widzi" to obietnica produktu,
              a obietnica wypowiedziana raz i nigdy więcej przestaje działać. Przy pełnym
              biurku schodzi o stopień, żeby nie zabierać miejsca polu zlecenia. */}
          <div className="mb-5">
            <h1 className={cases.length === 0 ? "t-display" : "t-h2"}>
              Dzień dobry, {u.firstName}.
            </h1>
            <p className="t-meta mt-0.5">To jest Twoje biurko. Nikt inny go nie widzi.</p>
          </div>

          <Suspense>
            <Composer quickTasks={u.quickTasks} policyFor={p} hasCases={cases.length} />
          </Suspense>

          <div className="mt-9">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="t-sekcja">Sprawy</h2>
              {cases.length >= ON_DESK && (
                <Link href={t("/cases")} className="t-meta hover:text-ink">
                  Wszystkie →
                </Link>
              )}
            </div>
            {cases.length === 0 ? (
              <div className="t-meta rounded-lg border border-dashed p-6 text-center">
                Nie masz jeszcze żadnej sprawy. Zacznij od kafelka powyżej albo napisz własne
                zlecenie.
              </div>
            ) : (
              <CaseList cases={cases} />
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
