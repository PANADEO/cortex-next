/**
 * Klient wykazu podatników VAT Ministerstwa Finansów („biała lista").
 *
 * Osobny plik od serwera MCP, bo to jedyna część, którą da się sprawdzić bez
 * stawiania transportu — i jedyna, w której błąd oznacza złą odpowiedź, a nie awarię.
 */

const BASE = "https://wl-api.mf.gov.pl/api"
const LIMIT_MS = 15_000

export class BadToolCall extends Error {}

/** Data w postaci, której wymaga API. Domyślnie dziś — bo o dzisiejszy stan pyta się najczęściej. */
export function day(data?: string): string {
  if (!data) return new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
    throw new BadToolCall(`Data „${data}" nie jest w formacie RRRR-MM-DD.`)
  return data
}

/** NIP bez myślników i spacji; dziesięć cyfr albo nic. */
export function nipCyfry(nip: string): string {
  const c = nip.replace(/[\s-]/g, "")
  if (!/^\d{10}$/.test(c))
    throw new BadToolCall(`„${nip}" to nie jest NIP — potrzebuję dziesięciu cyfr.`)
  return c
}

/** Numer rachunku: 26 znaków, bez spacji, bez prefiksu kraju. */
export function accountDigits(number: string): string {
  const c = number.replace(/[\s-]/g, "").replace(/^PL/i, "")
  if (!/^\d{26}$/.test(c))
    throw new BadToolCall(`„${number}" to nie jest numer rachunku — potrzebuję 26 cyfr.`)
  return c
}

/**
 * Kształt odpowiedzi wykazu — TYLKO te pola, po które sięgamy niżej.
 *
 * Pełny schemat MF ma ich kilkadziesiąt i połowa jest opcjonalna zależnie od
 * statusu podatnika. Opisywanie go w całości znaczyłoby utrzymywanie cudzego
 * kontraktu; opisany jest więc ten wycinek, którego brak faktycznie psuje
 * odpowiedź — a każde pole jest `?`, bo przychodzi z zewnątrz.
 */
type RegistryResponse = {
  result?: {
    subject?: {
      name?: string
      nip?: string
      statusVat?: string
      workingAddress?: string
      residenceAddress?: string
      accountNumbers?: string[]
      registrationLegalDate?: string
    }
    accountAssigned?: string
    requestId?: string
  }
}

async function download(path: string): Promise<RegistryResponse | null> {
  const signal = AbortSignal.timeout(LIMIT_MS)
  const r = await fetch(`${BASE}${path}`, {
    signal: signal,
    headers: { accept: "application/json" },
  })
  const text = (await r.json().catch(() => null)) as
    (RegistryResponse & Record<string, unknown>) | null
  if (!r.ok) {
    const code = text?.message ?? text?.code ?? `HTTP ${r.status}`
    throw new BadToolCall(`Wykaz odpowiedział błędem: ${code}`)
  }
  return text
}

export type Entity = {
  name: string
  nip: string
  statusVat: string
  address: string | null
  accounts: string[]
  dataRejestracji: string | null
}

export async function entityByNip(nip: string, data?: string): Promise<Entity | null> {
  const d = await download(`/search/nip/${nipCyfry(nip)}?date=${day(data)}`)
  const s = d?.result?.subject
  if (!s) return null
  return {
    name: s.name ?? "(bez nazwy)",
    nip: s.nip ?? nipCyfry(nip),
    statusVat: s.statusVat ?? "nieznany",
    address: s.workingAddress ?? s.residenceAddress ?? null,
    accounts: Array.isArray(s.accountNumbers) ? s.accountNumbers : [],
    dataRejestracji: s.registrationLegalDate ?? null,
  }
}

/**
 * Odpowiedź na pytanie, które naprawdę zadaje księgowość: czy TEN rachunek należał
 * do TEGO podatnika w TYM dniu. Zwraca też identyfikator żądania — to on jest dowodem
 * należytej staranności, więc musi wyjść na wierzch, a nie zostać w logu.
 */
export async function accountAssigned(nip: string, account: string, data?: string) {
  const d = await download(
    `/check/nip/${nipCyfry(nip)}/bank-account/${accountDigits(account)}?date=${day(data)}`,
  )
  const r = d?.result
  return {
    assigned: r?.accountAssigned === "TAK",
    raw: r?.accountAssigned ?? "nieznane",
    identyfikatorZapytania: r?.requestId ?? null,
    data: day(data),
  }
}
