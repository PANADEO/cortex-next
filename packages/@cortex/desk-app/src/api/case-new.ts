import * as audit from "@cortex/desk-core/audit-log"
import { policyFor } from "@cortex/desk-core/capability-gate"
import { migrate, pool } from "@cortex/desk-core/db"
import * as storage from "@cortex/desk-core/desk-storage"
import { whoAmI } from "@cortex/desk-core/identity"
import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"

export async function POST(req: Request) {
  await migrate()
  const u = await whoAmI()
  const { title } = await req.json().catch(() => ({ title: "Nowa sprawa" }))
  const id = randomUUID().slice(0, 8)
  await pool.query(`insert into desk.case_file (id, owner, title) values ($1,$2,$3)`, [
    id,
    u.id,
    (title || "Nowa sprawa").slice(0, 120),
  ])
  await storage.createFolder(u.id, storage.caseFolder(u.id, id))
  const p = await policyFor(u)
  await audit.write(u.id, "case.created", {
    caseId: id,
    fingerprint: p.fingerprint,
    capabilities: p.granted.map((z) => z.id),
  })
  return NextResponse.json({ id })
}
