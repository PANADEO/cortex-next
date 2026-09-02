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

/**
 * CO O TEJ OSOBIE WIE POWŁOKA.
 *
 * Powłoka trzyma swoich użytkowników w `system_config.users` — w TEJ SAMEJ bazie, tylko
 * w innym schemacie. Czytamy je zwykłym SQL-em zamiast wciągać drizzle i całą warstwę
 * bazy powłoki do pakietu, który stoi też w `apps/desk`; to była cena, przez którą
 * `identity.ts` świadomie ich wcześniej nie czytał.
 *
 * PODZIAŁ WŁASNOŚCI: powłoka wie, KTO to jest (imię i nazwisko) i czy w ogóle należy do
 * firmy. Biurko wie, co ta osoba może U SIEBIE — rola, dział, limit, nadania. Żadna
 * strona nie nadpisuje drugiej.
 *
 * Brak tabeli to normalny stan, nie awaria: `apps/desk` bywa uruchamiane samo.
 */
let shellHasUsers: boolean | null = null

async function shellKnowsUsers(): Promise<boolean> {
  if (shellHasUsers === null) {
    const r = await pool.query<{ t: string | null }>(
      `select to_regclass('system_config.users')::text as t`,
    )
    shellHasUsers = Boolean(r.rows[0]?.t)
  }
  return shellHasUsers
}

/**
 * „Aktywny" znaczy aktywny PO OBU STRONACH — przecięcie, nigdy suma. Osoba wyłączona
 * w powłoce nie wchodzi na Biurko, choćby Biurko o niej nie słyszało, i odwrotnie:
 * przełożony może wyłączyć konto w samym Biurku, nie ruszając katalogu firmowego.
 */
const SELECT_WITH_SHELL = `
  select p.id, p.email, p.first_name, p.last_name, p.department, p.role, p.daily_limit_usd,
         (p.active and coalesce(s.is_active, true)) as active,
         s.full_name as shell_name
    from desk.person p
    left join system_config.users s on lower(s.email) = p.email`

const SELECT_ALONE = `
  select id, email, first_name, last_name, department, role, daily_limit_usd, active,
         null::text as shell_name
    from desk.person p`

const select = async () => ((await shellKnowsUsers()) ? SELECT_WITH_SHELL : SELECT_ALONE)

type Row = {
  id: string
  email: string
  first_name: string
  last_name: string
  department: string
  role: string
  daily_limit_usd: string | null
  active: boolean
  shell_name: string | null
}

/**
 * Imię i nazwisko bierzemy z POWŁOKI, gdy je zna: to ona jest katalogiem firmowym,
 * a Biurko zgaduje je z adresu tylko wtedy, gdy nie ma skąd wziąć lepszych.
 */
const splitName = (r: Row): [string, string] => {
  if (!r.shell_name?.trim()) return [r.first_name, r.last_name]
  const parts = r.shell_name.trim().split(/\s+/)
  return [parts[0] ?? r.first_name, parts.slice(1).join(" ")]
}

const toUser = (r: Row): User => ({
  id: r.id,
  firstName: splitName(r)[0],
  lastName: splitName(r)[1],
  department: r.department,
  role: isRole(r.role) ? r.role : "member",
  quickTasks: quickTasksByRole[r.role] ?? quickTasksByRole["member"] ?? [],
  ...(r.daily_limit_usd === null ? {} : { dailyLimitUsd: Number(r.daily_limit_usd) }),
  active: r.active,
})

export async function everyone(): Promise<User[]> {
  await migrate()
  const r = await pool.query<Row>(`${await select()} order by p.last_name, p.first_name`)
  return r.rows.map(toUser)
}

export async function person(id: string): Promise<User | null> {
  await migrate()
  const r = await pool.query<Row>(`${await select()} where p.id=$1`, [id])
  return r.rows[0] ? toUser(r.rows[0]) : null
}

/** Identyfikator → „Imię Nazwisko". Jedno zapytanie zamiast wyszukiwania w pętli. */
export async function names(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const u of await everyone()) out[u.id] = `${u.firstName} ${u.lastName}`
  return out
}

/**
 * KTO WYDAJE ZGODĘ — z imienia, o ile da się je wskazać bez zgadywania.
 *
 * USTALENIE, KTÓRE TRZEBA POWIEDZIEĆ WPROST: Biurko NIE ZNA przełożonego pojedynczej
 * osoby. Takiego pola nie ma ani w `desk.person`, ani w katalogu powłoki
 * (`system_config.users` niesie imię, nazwisko i to, czy konto jest czynne). Biurko zna
 * ROLĘ: prośby rozpatruje `management` i wyłącznie ona — `PATCH /request` odrzuca
 * każdego innego. Imię na karcie odmowy bierze się więc z roli, a nie z relacji
 * podwładny–przełożony, bo takiej relacji tu po prostu nie ma.
 *
 * Gdy osób z tą rolą jest kilka, oddajemy `null` zamiast wybierać pierwszą z brzegu.
 * „Zgodę wydaje Robert Nowak" powiedziane o cudzym przełożonym jest GORSZE niż
 * „Zgodę wydaje Twój przełożony": wysyła człowieka do niewłaściwych drzwi, a prośba
 * i tak trafia do kolejki, którą widzą wszyscy z tej roli. Ta sama ścieżka obsługuje
 * wdrożenie, w którym roli `management` nie ma jeszcze wcale.
 */
export async function approver(): Promise<User | null> {
  const deciding = (await everyone()).filter((x) => x.role === "management" && x.active !== false)
  return deciding.length === 1 ? (deciding[0] ?? null) : null
}

/** „Imię Nazwisko" osoby wydającej zgodę — pusty napis, gdy nie da się jej wskazać. */
export async function approverName(): Promise<string> {
  const who = await approver()
  return who ? `${who.firstName} ${who.lastName}`.trim() : ""
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
  const found = await pool.query<Row>(`${await select()} where p.email=$1`, [email])
  if (found.rows[0]) return toUser(found.rows[0])

  // Imię i nazwisko pytamy najpierw POWŁOKĘ: to ona jest katalogiem firmowym.
  // Z adresu da się wyciągnąć co najwyżej „imię.nazwisko" i tyle udajemy, że wiemy,
  // dopiero gdy powłoka nic o tej osobie nie wie.
  const [firstName, lastName] = (await shellName(email)) ?? guessName(email)

  const r = await pool.query<{ id: string }>(
    `insert into desk.person (id, email, first_name, last_name, department, role)
     values ($1,$2,$3,$4,'','member')
     on conflict (email) do update set email = excluded.email
     returning id`,
    [email, email, firstName, lastName],
  )
  const created = r.rows[0]
  if (!created) throw new Error(`Nie udało się założyć konta dla ${email}.`)
  await audit.write(created.id, "person.created", { email })
  // Odczyt PRZEZ ten sam widok co reszta: `returning` z insertu zna wyłącznie kolumny
  // Biurka, więc oddawałby `active: true` osobie, którą powłoka ma za nieaktywną.
  const fresh = await person(created.id)
  if (!fresh) throw new Error(`Nie udało się odczytać konta ${created.id}.`)
  return fresh
}

/** Imię i nazwisko z katalogu powłoki, jeśli tam są. */
async function shellName(email: string): Promise<[string, string] | null> {
  if (!(await shellKnowsUsers())) return null
  const r = await pool.query<{ full_name: string | null }>(
    `select full_name from system_config.users where lower(email)=$1`,
    [email],
  )
  const full = r.rows[0]?.full_name?.trim()
  if (!full) return null
  const parts = full.split(/\s+/)
  return [parts[0] ?? full, parts.slice(1).join(" ")]
}

const guessName = (email: string): [string, string] => {
  const local = email.split("@")[0] ?? email
  const parts = local.split(/[._-]+/).filter(Boolean)
  const capitalise = (w: string) => w.charAt(0).toLocaleUpperCase("pl") + w.slice(1)
  return [capitalise(parts[0] ?? local), parts.length > 1 ? capitalise(parts.at(-1)!) : ""]
}

export async function setRole(id: string, role: Role, by: string): Promise<void> {
  await migrate()
  await pool.query(`update desk.person set role=$2 where id=$1`, [id, role])
  await audit.write(by, "person.role", { who: id, role })
}

/**
 * Limit dzienny jednej osoby. `null` przywraca wartość z roli — a to jest coś innego
 * niż zero: zero znaczyłoby „nie wolno ci nic", a my chcemy umieć powiedzieć
 * „wróć do tego, co ma każdy w twojej roli".
 */
export async function setDailyLimit(id: string, usd: number | null, by: string): Promise<void> {
  await migrate()
  if (usd !== null && (!Number.isFinite(usd) || usd < 0)) throw new Error("Limit musi być liczbą.")
  await pool.query(`update desk.person set daily_limit_usd=$2 where id=$1`, [id, usd])
  await audit.write(by, "person.limit", { who: id, usd })
}

/**
 * Wyłączenie i włączenie konta. Konto ZOSTAJE — jego sprawy, wpisy w dzienniku i nadania
 * są dowodem, którego nie kasuje się razem z odejściem człowieka z firmy. Wyłączone
 * konto po prostu nie wchodzi na Biurko, nawet gdy brama logowania je wpuści: członkostwo
 * jest własnością tego narzędzia, a nie tylko katalogu firmowego.
 */
export async function setActive(id: string, active: boolean, by: string): Promise<void> {
  await migrate()
  await pool.query(`update desk.person set active=$2 where id=$1`, [id, active])
  await audit.write(by, active ? "person.enabled" : "person.disabled", { who: id })
}

export async function setDepartment(id: string, department: string, by: string): Promise<void> {
  if (!isDepartment(department)) throw new Error(`Nie ma działu ${department}.`)
  await migrate()
  await pool.query(`update desk.person set department=$2 where id=$1`, [id, department])
  await audit.write(by, "person.department", { who: id, department })
}
