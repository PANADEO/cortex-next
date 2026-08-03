// Bramka kafelka Content Guru (code-api). Kolejność wg code-api/SKILL.md:
// auth PRZED jakąkolwiek pracą. Jedna warstwa w tej rundzie — druga,
// granularna bramka (`manage-templates`, wzorem Ilustromatu, design doc D6/
// D9) dochodzi w Round B razem z CRUD szablonów; nie ma jej jeszcze czego
// strzec, więc nie jest tu udawana.
//
// Zwraca `{ email }` znormalizowany przez requireTileAccess() (nigdy surowy
// nagłówek) — code-service "Rekordy per-user" pkt 3: userEmail przekazywany
// dalej do warstwy serwisowej MUSI pochodzić stąd, nigdy z ciała żądania.

import { requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"
import { CONTENT_GURU_APP_CODE } from "@/lib/content-guru/config"

export type ContentGuruAccessResult = { email: string } | { deny: NextResponse }

export async function requireContentGuruAccess(request: Request): Promise<ContentGuruAccessResult> {
  const access = await requireTileAccess(request, CONTENT_GURU_APP_CODE)
  if (access.allowed && access.email) return { email: access.email }

  // Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
  // znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
  const deny = access.email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
  return { deny }
}
