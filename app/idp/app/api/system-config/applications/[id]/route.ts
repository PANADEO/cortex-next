import {
  applicationPatchSchema,
  deleteApplication,
  getApplication,
  updateApplication,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, parseIdParam, toErrorResponse } from "../../_lib/guard"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Szczegóły jednego kafelka RAZEM z kompletem tłumaczeń
 * (PROJECT/cortex-frontend/ARTIFACTS/i18n/cortex-frontend-tlumaczenia-nazw-
 * kafelkow-projekt.md). Ten sam kształt co element `GET .../applications`, bo
 * to ta sama dana — ekran szczegółów nie ma wybierać między "pobierz całą
 * listę" a "pobierz coś innego niż lista".
 *
 * Zwraca KOMPLET tłumaczeń, a nie nazwę w języku pytającego: serwer nie zna
 * języka użytkownika (wybór siedzi w `localStorage`), więc rozstrzyganie
 * nazwy zostaje po stronie klienta.
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const application = await getApplication(id)
    if (!application) return NextResponse.json({ error: "unknown-application" }, { status: 404 })
    return NextResponse.json(application)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  // PATCH przyjmuje SAME zmieniane pola — reguły międzypolowe (natywny ma
  // route, zewnętrzny ma url) sprawdza serwis na wierszu po scaleniu.
  const parsed = applicationPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const updated = await updateApplication(id, parsed.data)
    if (!updated) return NextResponse.json({ error: "unknown-application" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const { id } = await context.params
  const invalidId = parseIdParam(id)
  if (invalidId) return invalidId

  try {
    const removed = await deleteApplication(id)
    if (!removed) return NextResponse.json({ error: "unknown-application" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}
