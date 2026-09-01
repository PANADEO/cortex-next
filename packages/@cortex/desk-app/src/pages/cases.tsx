import { migrate, pool } from "@cortex/desk-core/db"
import { countResults } from "@cortex/desk-core/folder-server"
import { viewer } from "@cortex/desk-core/identity"
import { CaseList, type CaseRow } from "@cortex/desk-ui/components/case-list"
import { Shell } from "@cortex/desk-ui/components/shell"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { t } from "@cortex/desk-ui/routes"
import Link from "next/link"

/**
 * Wszystkie sprawy — z prawdziwym STRONICOWANIEM, nie z uciętą listą i przypisem.
 *
 * Poprzednie wydanie pokazywało dwieście najnowszych i mówiło, ile ich jest naprawdę.
 * To było uczciwe, ale niepełne: do reszty nie dało się dojść ŻADNĄ drogą, więc sprawa
 * sprzed dwustu innych była w praktyce skasowana.
 *
 * Numer strony siedzi w ADRESIE, nie w stanie komponentu — z tego samego powodu, co
 * sekcje Nadzoru: da się to wysłać linkiem, zakładkować i cofnąć przyciskiem wstecz,
 * a serwer pobiera wyłącznie tę stronę, na którą ktoś patrzy.
 */
const PER_PAGE = 50

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await migrate()
  const u = await viewer()
  const translate = await deskT()

  const asked = Number((await searchParams)?.strona ?? 1)
  const all = await pool.query<{ n: number }>(
    `select count(*)::int as n from desk.case_file where owner=$1`,
    [u.id],
  )
  const total = all.rows[0]?.n ?? 0
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))
  // Numer spoza zakresu przycinamy zamiast oddawać pustą stronę: adres z odręcznie
  // wpisaną setką ma pokazać ostatnią stronę, a nie wyglądać na brak spraw.
  const page = Number.isFinite(asked) ? Math.min(Math.max(1, Math.trunc(asked)), pages) : 1

  const s = await pool.query(
    `select id, title, status, reason, updated_at as "updatedAt" from desk.case_file
      where owner=$1 order by updated_at desc limit $2 offset $3`,
    [u.id, PER_PAGE, (page - 1) * PER_PAGE],
  )
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

  const link = (n: number) => `${t("/cases")}?strona=${n}`

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

            {pages > 1 && (
              <nav
                aria-label={translate("cases.pages")}
                className="mt-4 flex items-center justify-between gap-3"
              >
                {/* Zwykłe `<a>`, nie przycisk: działa środkowy przycisk myszy,
                    „otwórz w nowej karcie" i klawiatura, a strona nie potrzebuje
                    do tego ani grama JavaScriptu. */}
                {page > 1 ? (
                  <Link href={link(page - 1)} className="t-btn rounded-md border px-3 py-1.5">
                    {translate("cases.newer")}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="t-meta tabular-nums">
                  {translate("cases.pageOf", { page, pages, total })}
                </span>
                {page < pages ? (
                  <Link href={link(page + 1)} className="t-btn rounded-md border px-3 py-1.5">
                    {translate("cases.older")}
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
