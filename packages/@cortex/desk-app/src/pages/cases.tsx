import { migrate, pool } from "@cortex/desk-core/db"
import { countResults } from "@cortex/desk-core/folder-server"
import { whoAmI } from "@cortex/desk-core/identity"
import { CaseList, type CaseRow } from "@cortex/desk-ui/components/case-list"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskT } from "@cortex/desk-ui/i18n/server"

export default async function Page() {
  await migrate()
  const u = await whoAmI()
  const translate = await deskT()
  // Lista jest ucięta i ekran ma to POWIEDZIEĆ. Wcześniej pasek boczny pisał
  // „Wszystkie sprawy (935)", a ta strona pokazywała dwieście i milczała — czyli
  // dokładnie ta cicha nieprawda, przed którą ten produkt ma bronić.
  const NEWEST = 200
  const s = await pool.query(
    `select id, title, status, reason, updated_at as "updatedAt" from desk.case_file where owner=$1 order by updated_at desc limit $2`,
    [u.id, NEWEST],
  )
  const all = await pool.query<{ n: number }>(
    `select count(*)::int as n from desk.case_file where owner=$1`,
    [u.id],
  )
  const total = all.rows[0]?.n ?? 0
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
          <h1 className="t-display">{translate("cases.title")}</h1>
          <p className="t-body mt-1 text-desk-muted">{translate("cases.lead")}</p>
          <div className="mt-6">
            {cases.length === 0 ? (
              <div className="t-meta rounded-lg border border-dashed p-6 text-center">
                {translate("shell.casesEmpty")}
              </div>
            ) : (
              <CaseList cases={cases} />
            )}
            {total > cases.length && (
              <p className="t-meta mt-3">
                {translate("cases.truncated", { shown: cases.length, total })}
              </p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
