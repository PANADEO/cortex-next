import capabilitiesJson from "../seed/capabilities.json"
import usersJson from "../seed/users.json"
import * as audit from "./audit-log"
import { migrate, pool } from "./db"
import type { Role, User } from "./types"

/**
 * LUDZIE BIURKA — wiersze, nie wpisy w pliku.
 *
 * Do tej pory `identity.ts` szukał adresu w `seed/users.json` i rzucał wyjątkiem, gdy go
 * tam nie było. U klienta znaczyło to, że na Biurko wejdą dokładnie dwie osoby, a reszta
 * firmy dostanie błąd. To nie był brak funkcji do dopisania później, tylko granica między
 * demem a produktem: wszystko powyżej — zespół, nadania, odbieranie zgód — stoi na tym,
 * że osoba jest wierszem.
 *
 * Zasiew NIE znika: wsypuje się do tabeli przy migracji jako stan początkowy pokazu.
 * Przestaje być jedynym źródłem.
 */

/** Zlecenia startowe należą do ROLI, nie do osoby — inaczej nowa osoba nie ma żadnych. */
export const quickTasksByRole = capabilitiesJson.quickTasks as Record<string, string[]>

export const ROLES = Object.keys(capabilitiesJson.roles) as Role[]

/** Persony pokazu — zasiew tabeli osób i jedyne miejsce, gdzie są jeszcze wypisane. */
export const demoPeople = usersJson.users

/**
 * Dział jest WARTOŚCIĄ z zamkniętej listy, nie polem tekstowym. Gdyby przełożony mógł
 * wpisać dowolny napis, ekran po angielsku pokazywałby polską nazwę wpisaną kiedyś
 * ręcznie — a dział jest tu właścicielem zgody, więc musi dać się z czymś zestawić.
 */
export const DEPARTMENTS = capabilitiesJson.departments as string[]

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as string[]).includes(value)

export const isDepartment = (value: unknown): value is string =>
  typeof value === "string" && DEPARTMENTS.includes(value)

type Row = {
  id: string
  email: string
  first_name: string
  last_name: string
  department: string
  role: string
}

const toUser = (r: Row): User => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  department: r.department,
  role: isRole(r.role) ? r.role : "member",
  quickTasks: quickTasksByRole[r.role] ?? quickTasksByRole["member"] ?? [],
})

const SELECT = `select id, email, first_name, last_name, department, role from desk.person`

export async function everyone(): Promise<User[]> {
  await migrate()
  const r = await pool.query<Row>(`${SELECT} order by last_name, first_name`)
  return r.rows.map(toUser)
}

export async function person(id: string): Promise<User | null> {
  await migrate()
  const r = await pool.query<Row>(`${SELECT} where id=$1`, [id])
  return r.rows[0] ? toUser(r.rows[0]) : null
}

/** Identyfikator → „Imię Nazwisko". Jedno zapytanie zamiast wyszukiwania w pętli. */
export async function names(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const u of await everyone()) out[u.id] = `${u.firstName} ${u.lastName}`
  return out
}

/**
 * Osoba spod bramy logowania. Nieznany adres ZAKŁADA KONTO, a nie rzuca wyjątkiem.
 *
 * Rola startowa to `member`, i to nie jest wygoda, tylko rachunek: w tym katalogu
 * `member` to pięć zdolności, z których żadna nie wychodzi poza biurko tej osoby ani
 * poza firmę — przeglądanie własnych plików, czytanie ich, napisanie dokumentu,
 * sprawdzenie go po zapisie i odłożenie do własnych plików. Wszystko powyżej —
 * arkusze, kod, obrazy, wykaz VAT — wymaga nadania przez przełożonego.
 *
 * Założenie konta idzie do dziennika. Pierwsze wejście nowej osoby do narzędzia,
 * które pracuje na jej plikach, jest zdarzeniem, o którym audytor ma prawo wiedzieć.
 */
export async function ensurePerson(email: string): Promise<User> {
  await migrate()
  const found = await pool.query<Row>(`${SELECT} where email=$1`, [email])
  if (found.rows[0]) return toUser(found.rows[0])

  const local = email.split("@")[0] ?? email
  // Z adresu da się wyciągnąć co najwyżej „imię.nazwisko" — i tylko tyle udajemy,
  // że wiemy. Reszta jest do poprawienia przez przełożonego na ekranie zespołu.
  const parts = local.split(/[._-]+/).filter(Boolean)
  const capitalise = (w: string) => w.charAt(0).toLocaleUpperCase("pl") + w.slice(1)
  const firstName = capitalise(parts[0] ?? local)
  const lastName = parts.length > 1 ? capitalise(parts[parts.length - 1]!) : ""

  const r = await pool.query<Row>(
    `insert into desk.person (id, email, first_name, last_name, department, role)
     values ($1,$2,$3,$4,'','member')
     on conflict (email) do update set email = excluded.email
     returning id, email, first_name, last_name, department, role`,
    [email, email, firstName, lastName],
  )
  const created = r.rows[0]
  if (!created) throw new Error(`Nie udało się założyć konta dla ${email}.`)
  await audit.write(created.id, "person.created", { email })
  return toUser(created)
}

export async function setRole(id: string, role: Role, by: string): Promise<void> {
  await migrate()
  await pool.query(`update desk.person set role=$2 where id=$1`, [id, role])
  await audit.write(by, "person.role", { who: id, role })
}

export async function setDepartment(id: string, department: string, by: string): Promise<void> {
  if (!isDepartment(department)) throw new Error(`Nie ma działu ${department}.`)
  await migrate()
  await pool.query(`update desk.person set department=$2 where id=$1`, [id, department])
  await audit.write(by, "person.department", { who: id, department })
}
