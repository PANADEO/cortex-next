import { migrate, pool } from "@cortex/desk-core/db"
import { countResults } from "@cortex/desk-core/folder-server"
import { whoAmI } from "@cortex/desk-core/identity"
import { CaseList, type CaseRow } from "@cortex/desk-ui/components/case-list"
import { Shell } from "@cortex/desk-ui/components/shell"

export default async function Page() {
  await migrate()
  const u = await whoAmI()
  const s = await pool.query(
    `select id, title, status, reason, updated_at as "updatedAt" from desk.case_file where owner=$1 order by updated_at desc limit 200`,
    [u.id],
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
      <div className="h-full overflow-y-auto pb-desk-bar md:pb-0">
        <div className="mx-auto max-w-desk-stream px-5 py-8">
          <h1 className="t-display">Wszystkie sprawy</h1>
          <p className="t-body mt-1 text-desk-muted">
            Sprawy zostają na biurku — możesz wrócić do każdej.
          </p>
          <div className="mt-6">
            {cases.length === 0 ? (
              <div className="t-meta rounded-lg border border-dashed p-6 text-center">
                Twoje sprawy pojawią się tutaj.
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
