import { policyFor } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { CaseView } from "@cortex/desk-ui/components/case-view"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { notFound } from "next/navigation"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await migrate()
  const { id } = await params
  const u = await whoAmI()
  const translate = await deskT()
  const s = await pool.query(`select owner from desk.case_file where id=$1`, [id])
  if (!s.rowCount) notFound()
  if (s.rows[0].owner !== u.id) {
    return (
      <Shell>
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <div className="t-h2">{translate("case.notYours")}</div>
            <p className="t-body mt-1 text-desk-muted">{translate("case.notYoursLead")}</p>
          </div>
        </div>
      </Shell>
    )
  }
  const p = await policyFor(u)
  return (
    <Shell active={id} withoutBottomBar>
      <CaseView id={id} policyFor={p} />
    </Shell>
  )
}
