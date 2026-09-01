import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { NextResponse } from "next/server"

/**
 * Wyłącznie dla testów: zakłada sprawę i dopisuje do niej zdarzenie „odłożyłem ten plik
 * do Moich plików" — dokładnie w kształcie, w jakim zapisuje je `save_to_my_files`.
 *
 * DLACZEGO TO ISTNIEJE. Plakietkę pochodzenia da się zobaczyć wyłącznie wtedy, gdy plik
 * naprawdę przyszedł ze sprawy, a to znaczy: przebieg modelu. Scenariusz, który go odpala,
 * kosztuje pieniądze i jest odcięty od bramki, więc bez tej trasy jedynym scenariuszem
 * pochodzenia zostałby ten NEGATYWNY — a on jest zielony także wtedy, gdy plakietka nie
 * pokazuje się nigdy i nikomu. Zdarzenie zasiewamy, złączenie i ekran sprawdzamy naprawdę.
 *
 * Sprawa o tym samym tytule jest kasowana przed zasiewem, żeby kolejne przebiegi nie
 * zostawiały po sobie stosu spraw. Poza trybem deweloperskim trasa odpowiada 404.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.DESK_ALLOW_RESET) {
    return NextResponse.json({ error: "Nie ma takiej trasy." }, { status: 404 })
  }
  const u = await whoAmI()
  const b = await req.json()
  const title: string = b.title
  const path: string = b.path
  if (!title || !path) {
    return NextResponse.json({ error: "Potrzebne są `title` i `path`." }, { status: 400 })
  }
  await migrate()
  await pool.query(`delete from desk.case_file where owner=$1 and title=$2`, [u.id, title])
  const id = `test-${Date.now()}`
  await pool.query(
    `insert into desk.case_file (id, owner, title, status) values ($1,$2,$3,'done')`,
    [id, u.id, title],
  )
  await pool.query(`insert into desk.event (case_id, payload) values ($1,$2)`, [
    id,
    JSON.stringify({
      type: "tool_end",
      id: `${id}-save`,
      name: "save_to_my_files",
      ok: true,
      summary: path,
      ms: 5,
    }),
  ])
  return NextResponse.json({ ok: true, id })
}
