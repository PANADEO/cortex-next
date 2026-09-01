import * as audit from "./audit-log"
import { migrate, pool } from "./db"

/**
 * KTO MOŻE ZOBACZYĆ SPRAWĘ — jedno miejsce, bo reguła musi być ta sama na stronie
 * i na trasie. Rozjazd między nimi znaczyłby ekran, który się rysuje, i dane, których
 * nie ma — albo, gorzej, odwrotnie.
 *
 * Domyślnie sprawy nie widzi nikt poza właścicielem. Ta reguła zostaje; dochodzi do niej
 * pierwszy i jedyny wyjątek: osoba, której WŁAŚCICIEL sprawę udostępnił.
 *
 * Przełożony NIE dostaje wglądu z urzędu. Ma dziennik i ekran zespołu — nadzór nad tym,
 * co wolno, to co innego niż czytanie cudzej pracy. Gdyby mógł otworzyć każdą sprawę,
 * zdanie „prywatna przestrzeń pracy" przestałoby cokolwiek znaczyć, a stoi ono dziś przy
 * „Moich plikach" i przy pamięci.
 */

export type CaseAccess = "owner" | "guest" | "none"

export async function accessTo(caseId: string, who: string): Promise<CaseAccess> {
  await migrate()
  const s = await pool.query<{ owner: string }>(`select owner from desk.case_file where id=$1`, [
    caseId,
  ])
  const owner = s.rows[0]?.owner
  if (!owner) return "none"
  if (owner === who) return "owner"
  const g = await pool.query(`select 1 from desk.case_share where case_id=$1 and who=$2`, [
    caseId,
    who,
  ])
  return g.rowCount ? "guest" : "none"
}

export type Share = { who: string; at: string }

export async function sharesOf(caseId: string): Promise<Share[]> {
  await migrate()
  const r = await pool.query<{ who: string; at: Date }>(
    `select who, at from desk.case_share where case_id=$1 order by at`,
    [caseId],
  )
  return r.rows.map((w) => ({ who: w.who, at: w.at.toISOString() }))
}

/** Sprawy udostępnione MNIE — osobna lista, bo to nie są moje sprawy. */
export async function sharedWith(who: string, limit = 20) {
  await migrate()
  const r = await pool.query(
    `select c.id, c.title, c.status, c.owner, c.updated_at as "updatedAt"
       from desk.case_share s join desk.case_file c on c.id = s.case_id
      where s.who=$1 order by c.updated_at desc limit $2`,
    [who, limit],
  )
  return r.rows
}

export async function share(caseId: string, who: string, by: string): Promise<void> {
  await migrate()
  await pool.query(
    `insert into desk.case_share (case_id, who, shared_by) values ($1,$2,$3)
     on conflict (case_id, who) do nothing`,
    [caseId, who, by],
  )
  await audit.write(by, "case.shared", { caseId, toWhom: who })
}

export async function unshare(caseId: string, who: string, by: string): Promise<void> {
  await migrate()
  await pool.query(`delete from desk.case_share where case_id=$1 and who=$2`, [caseId, who])
  await audit.write(by, "case.unshared", { caseId, toWhom: who })
}

export type CaseMessage = { id: number; who: string; text: string; at: string }

export async function messages(caseId: string): Promise<CaseMessage[]> {
  await migrate()
  const r = await pool.query<{ id: string; who: string; text: string; at: Date }>(
    `select id, who, text, at from desk.case_message where case_id=$1 order by id`,
    [caseId],
  )
  return r.rows.map((w) => ({ id: Number(w.id), who: w.who, text: w.text, at: w.at.toISOString() }))
}

export const MESSAGE_MAX_CHARS = 1000

/**
 * Wiadomość między ludźmi. NIE jest zdarzeniem sprawy i nie ma jej w tym, co dostaje
 * model — dlatego siedzi we własnej tabeli. Wrzucona do strumienia zdarzeń zamieniłaby
 * uwagę rzuconą na boku w polecenie dla agenta.
 */
export async function say(caseId: string, who: string, text: string): Promise<CaseMessage> {
  await migrate()
  const clean = text.trim().slice(0, MESSAGE_MAX_CHARS)
  const r = await pool.query<{ id: string; who: string; text: string; at: Date }>(
    `insert into desk.case_message (case_id, who, text) values ($1,$2,$3)
     returning id, who, text, at`,
    [caseId, who, clean],
  )
  const created = r.rows[0]
  if (!created) throw new Error("Nie udało się zapisać wiadomości.")
  // Dziennik notuje, że przy sprawie padła wiadomość — bez treści, tak jak przy pamięci.
  await audit.write(who, "case.message", { caseId })
  return {
    id: Number(created.id),
    who: created.who,
    text: created.text,
    at: created.at.toISOString(),
  }
}
