import { policyFor } from "@cortex/desk-core/capability-gate"
import { accessTo } from "@cortex/desk-core/case-access"
import { migrate, pool } from "@cortex/desk-core/db"
import { viewer } from "@cortex/desk-core/identity"
import { everyone, names } from "@cortex/desk-core/people"
import { CaseView } from "@cortex/desk-ui/components/case-view"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { notFound } from "next/navigation"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await migrate()
  const { id } = await params
  const u = await viewer()
  const translate = await deskT()
  const s = await pool.query(`select owner from desk.case_file where id=$1`, [id])
  if (!s.rowCount) notFound()
  const access = await accessTo(id, u.id)
  if (access === "none") {
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
      {/* Gość ogląda, nie zleca: pole zlecenia dostaje wyłącznie właściciel. Jedna
          reguła zamiast czterech wyjątków — poszerzymy ją świadomie, gdy okaże się
          za wąska. */}
      <CaseView
        id={id}
        policyFor={p}
        readOnly={access === "guest"}
        people={await names()}
        everyone={(await everyone()).map((x) => ({
          id: x.id,
          name: `${x.firstName} ${x.lastName}`.trim() || x.id,
        }))}
        me={u.id}
      />
    </Shell>
  )
}
