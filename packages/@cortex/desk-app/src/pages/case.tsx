import { policyFor } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { CaseView } from "@cortex/desk-ui/components/case-view"
import { Shell } from "@cortex/desk-ui/components/shell"
import { notFound } from "next/navigation"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await migrate()
  const { id } = await params
  const u = await whoAmI()
  const s = await pool.query(`select owner from desk.case_file where id=$1`, [id])
  if (!s.rowCount) notFound()
  if (s.rows[0].owner !== u.id) {
    return (
      <Shell>
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <div className="t-h2">To nie jest Twoja sprawa</div>
            <p className="t-tresc mt-1 text-cichy">
              Każdy pracownik widzi wyłącznie własne biurko.
            </p>
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
