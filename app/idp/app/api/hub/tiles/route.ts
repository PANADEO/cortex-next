// Katalog kafelków huba — WYŁĄCZNIE metadane wyglądu (D7,
// PROJECT/cortex-frontend-hub-db-driven-projekt.md), zero nowej logiki
// dostępu. Dostępny każdemu zalogowanemu, świadomie BEZ requireTileAccess()
// ani żadnej innej bramki kafelka — dokładnie tak, jak dziś dostępny jest
// sam hub.
//
// Metadane WSZYSTKICH dzisiejszych ~25 kafelków (etykieta, opis, ikona,
// href) SĄ JUŻ DZIŚ publicznie dostępne każdemu zalogowanemu userowi przez
// statyczny import TILES w kliencie (tile-grid.tsx, command-palette.tsx).
// Ten endpoint nie zwiększa tej ekspozycji — przenosi te same dane z bundla
// do fetcha i w praktyce ją redukuje (filtruje is_active/show_on_hub, czego
// statyczny bundle dziś nie robi wcale).
//
// "Kto widzi który kafelek" nadal rozstrzyga WYŁĄCZNIE canAccessTile() po
// stronie klienta na liście z /api/me/access — nietknięte przez ten route.
import { getRequestEmail, listHubApplications } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const email = getRequestEmail(request.headers)
  if (!email) {
    return NextResponse.json({ error: "missing-email" }, { status: 401 })
  }

  try {
    return NextResponse.json(await listHubApplications())
  } catch (error) {
    console.error("[hub] błąd odczytu katalogu kafelków:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
