// Sekcja "Grupa OpenWebUI" na ekranie roli (PROJECT/cortex-frontend-sync-
// uprawnien-openwebui-projekt.md, D8 zaadaptowane pod Wariant A — decyzja
// Alexa 31.07.2026: mapowanie klucza to ROLA, nie aplikacja).
//
// GET  — stan mapowania + PODGLĄD bez zapisu (previewRoleGroupSync, R2) +
//        lista dostępnych grup OpenWebUI (do wyboru "podepnij istniejącą").
// PUT  — podepnij (utwórz nową ALBO wskaż istniejącą) / odepnij. Celowo NIE
//        pushuje członkostwa od razu (D7 "utworzenie: nic") — pierwszy realny
//        push idzie dopiero przez POST albo przy najbliższej mutacji ról.
// POST — "Synchronizuj teraz" dla TEJ jednej roli.

import type { OpenwebuiGroupMappingRow } from "@cortex/db"
import {
  attachRoleGroup,
  detachRoleGroup,
  getOpenwebuiRoleGroupMapping,
  listOpenwebuiGroups,
  OpenwebuiClientError,
  openwebuiConfig,
  previewRoleGroupSync,
  reconcileRoleGroup,
  type OpenwebuiGroupSummary,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

const putBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("existing"), groupId: z.string().min(1).max(200) }),
  z.object({ action: z.literal("detach") }),
])

function serializeMapping(mapping: OpenwebuiGroupMappingRow) {
  return {
    groupId: mapping.groupId,
    groupName: mapping.groupName,
    lastSyncedAt: mapping.lastSyncedAt ? mapping.lastSyncedAt.toISOString() : null,
    lastSyncError: mapping.lastSyncError,
  }
}

async function listAvailableGroups(): Promise<OpenwebuiGroupSummary[] | null> {
  const config = openwebuiConfig()
  if (!config) return null
  try {
    return await listOpenwebuiGroups(config)
  } catch {
    // Panel ma dalej działać (podgląd stanu mapowania), nawet gdy OpenWebUI
    // akurat nie odpowiada na samo wypisanie grup do wyboru.
    return []
  }
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const [mapping, availableGroups] = await Promise.all([
      getOpenwebuiRoleGroupMapping(id),
      listAvailableGroups(),
    ])

    if (!mapping) {
      return NextResponse.json({
        mapping: null,
        configured: availableGroups !== null,
        availableGroups,
      })
    }

    const preview = await previewRoleGroupSync(id)
    return NextResponse.json({
      mapping: serializeMapping(mapping),
      configured: availableGroups !== null,
      availableGroups,
      preview,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = putBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    if (parsed.data.action === "detach") {
      const detached = await detachRoleGroup(id)
      return NextResponse.json({ ok: true, detached })
    }

    const result = await attachRoleGroup({
      roleId: id,
      action:
        parsed.data.action === "create"
          ? { kind: "create" }
          : { kind: "existing", groupId: parsed.data.groupId },
    })

    if ("error" in result) {
      if (result.error === "not-configured") {
        return NextResponse.json({ error: "openwebui-not-configured" }, { status: 503 })
      }
      // unknown-role | group-not-found — oba "nie ma czego wskazać", 404.
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ mapping: serializeMapping(result.mapping) })
  } catch (error) {
    if (error instanceof OpenwebuiClientError) {
      return NextResponse.json(
        { error: "openwebui-upstream-error", message: error.message },
        { status: 502 },
      )
    }
    return toErrorResponse(error)
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const openwebuiSync = await reconcileRoleGroup(id)
    return NextResponse.json({ openwebuiSync })
  } catch (error) {
    return toErrorResponse(error)
  }
}
