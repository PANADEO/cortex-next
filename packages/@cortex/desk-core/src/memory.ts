import * as audit from "./audit-log"
import { migrate, pool } from "./db"

/**
 * PAMIĘĆ ASYSTENTA — pierwsza rzecz w tym narzędziu, która mogłaby złamać jego tezę.
 *
 * Produkt sprzedaje zdanie „widzisz, co asystent zrobił i z czego". Pamięć jest wiedzą
 * o człowieku, gromadzoną poza jego wzrokiem i wpływającą na KAŻDĄ kolejną sprawę —
 * więc albo spełnia trzy warunki naraz, albo nie robimy jej wcale:
 *
 *   1. widać całość, nie próbkę,
 *   2. człowiek jest właścicielem — dopisuje, poprawia, kasuje bez niczyjej zgody,
 *   3. NIC nie wchodzi samo: asystent proponuje, człowiek przyjmuje.
 *
 * Punkt trzeci ma ten sam kształt, co zatwierdzanie narzędzi obcego serwera MCP.
 * Ta symetria nie jest ozdobna — jest jedynym powodem, dla którego da się o tej
 * pamięci powiedzieć „to jest twoje".
 */

export type Memory = {
  id: number
  text: string
  status: "proposed" | "kept"
  sourceCaseId: string | null
  createdAt: string
}

/**
 * Trzydzieści wspomnień po 400 znaków. Granica nie bierze się z ostrożności wobec bazy,
 * tylko stąd, że CAŁOŚĆ idzie do promptu każdej tury — a prompt bez granicy to koszt
 * bez granicy. Po przekroczeniu ekran mówi wprost, że trzeba coś skasować; urwanie
 * po cichu znaczyłoby, że asystent przestał pamiętać coś, co człowiek widzi na liście.
 */
export const MEMORY_LIMIT = 30
export const MEMORY_MAX_CHARS = 400

type Row = {
  id: string
  text: string
  status: string
  source_case_id: string | null
  created_at: Date
}

const toMemory = (r: Row): Memory => ({
  id: Number(r.id),
  text: r.text,
  status: r.status === "proposed" ? "proposed" : "kept",
  sourceCaseId: r.source_case_id,
  createdAt: r.created_at.toISOString(),
})

const SELECT = `select id, text, status, source_case_id, created_at from desk.memory`

export async function all(owner: string): Promise<Memory[]> {
  await migrate()
  // Propozycje na górze: to jedyne pozycje, które czekają na człowieka.
  const r = await pool.query<Row>(
    `${SELECT} where owner=$1 order by (status='proposed') desc, created_at desc`,
    [owner],
  )
  return r.rows.map(toMemory)
}

/** To, co naprawdę jedzie do promptu. Propozycji tu nie ma i to jest cały sens. */
export async function kept(owner: string): Promise<Memory[]> {
  await migrate()
  const r = await pool.query<Row>(
    `${SELECT} where owner=$1 and status='kept' order by created_at limit $2`,
    [owner, MEMORY_LIMIT],
  )
  return r.rows.map(toMemory)
}

export class MemoryFull extends Error {
  constructor() {
    super(`Pamięć mieści ${MEMORY_LIMIT} rzeczy.`)
    this.name = "MemoryFull"
  }
}

async function countKept(owner: string): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `select count(*)::text as n from desk.memory where owner=$1 and status='kept'`,
    [owner],
  )
  return Number(r.rows[0]?.n ?? 0)
}

/**
 * Propozycja od asystenta. NIE wchodzi do promptu, dopóki człowiek jej nie przyjmie.
 * Limit sprawdzamy dopiero przy przyjęciu — propozycja, której nie da się złożyć, bo
 * pamięć jest pełna, znikałaby bez śladu i człowiek nawet by nie wiedział, co przepadło.
 */
export async function propose(owner: string, text: string, caseId: string): Promise<Memory> {
  await migrate()
  const clean = text.trim().slice(0, MEMORY_MAX_CHARS)
  const r = await pool.query<Row>(
    `insert into desk.memory (owner, text, status, source_case_id) values ($1,$2,'proposed',$3)
     returning id, text, status, source_case_id, created_at`,
    [owner, clean, caseId],
  )
  const created = r.rows[0]
  if (!created) throw new Error("Nie udało się zapisać propozycji.")
  return toMemory(created)
}

/** Wpis własny człowieka — od razu przyjęty, bo to on jest właścicielem tej przestrzeni. */
export async function add(owner: string, text: string): Promise<Memory> {
  await migrate()
  if ((await countKept(owner)) >= MEMORY_LIMIT) throw new MemoryFull()
  const clean = text.trim().slice(0, MEMORY_MAX_CHARS)
  const r = await pool.query<Row>(
    `insert into desk.memory (owner, text, status, decided_at) values ($1,$2,'kept',now())
     returning id, text, status, source_case_id, created_at`,
    [owner, clean],
  )
  const created = r.rows[0]
  if (!created) throw new Error("Nie udało się zapisać wspomnienia.")
  // Dziennik NIE dostaje treści: pamięć jest prywatną przestrzenią tej osoby.
  await audit.write(owner, "memory.added", { id: Number(created.id) })
  return toMemory(created)
}

export async function accept(owner: string, id: number): Promise<void> {
  await migrate()
  if ((await countKept(owner)) >= MEMORY_LIMIT) throw new MemoryFull()
  await pool.query(
    `update desk.memory set status='kept', decided_at=now() where id=$1 and owner=$2`,
    [id, owner],
  )
  await audit.write(owner, "memory.accepted", { id })
}

export async function edit(owner: string, id: number, text: string): Promise<void> {
  await migrate()
  await pool.query(`update desk.memory set text=$3 where id=$1 and owner=$2`, [
    id,
    owner,
    text.trim().slice(0, MEMORY_MAX_CHARS),
  ])
  await audit.write(owner, "memory.edited", { id })
}

export async function forget(owner: string, id: number): Promise<void> {
  await migrate()
  await pool.query(`delete from desk.memory where id=$1 and owner=$2`, [id, owner])
  await audit.write(owner, "memory.forgotten", { id })
}

/**
 * Fragment promptu z pamięcią. Osobno od `runtime.ts`, bo to jedyne miejsce, w którym
 * da się sprawdzić bez wołania modelu, że wspomnienia idą do niego DOSŁOWNIE — nie
 * streszczone i nie przeredagowane. Człowiek na ekranie „Pamięć” widzi dokładnie te
 * zdania, więc każda różnica byłaby cichym kłamstwem tego ekranu.
 */
export function recallBlock(memories: Memory[]): string {
  if (memories.length === 0) return ""
  const lines = memories.map((m) => `- ${m.text}`).join("\n")
  return `\n\nCo wiesz o tej osobie z poprzednich spraw (ona to zatwierdziła i widzi na ekranie „Pamięć”):\n${lines}`
}
