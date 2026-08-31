/**
 * Klient wykazu podatników VAT Ministerstwa Finansów („biała lista").
 *
 * Osobny plik od serwera MCP, bo to jedyna część, którą da się sprawdzić bez
 * stawiania transportu — i jedyna, w której błąd oznacza złą odpowiedź, a nie awarię.
 */

const BAZA = 'https://wl-api.mf.gov.pl/api'
const LIMIT_MS = 15_000

export class BledneWywolanie extends Error {}

/** Data w postaci, której wymaga API. Domyślnie dziś — bo o dzisiejszy stan pyta się najczęściej. */
export function dzien(data?: string): string {
  if (!data) return new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new BledneWywolanie(`Data „${data}" nie jest w formacie RRRR-MM-DD.`)
  return data
}

/** NIP bez myślników i spacji; dziesięć cyfr albo nic. */
export function nipCyfry(nip: string): string {
  const c = nip.replace(/[\s-]/g, '')
  if (!/^\d{10}$/.test(c)) throw new BledneWywolanie(`„${nip}" to nie jest NIP — potrzebuję dziesięciu cyfr.`)
  return c
}

/** Numer rachunku: 26 znaków, bez spacji, bez prefiksu kraju. */
export function rachunekCyfry(nr: string): string {
  const c = nr.replace(/[\s-]/g, '').replace(/^PL/i, '')
  if (!/^\d{26}$/.test(c)) throw new BledneWywolanie(`„${nr}" to nie jest numer rachunku — potrzebuję 26 cyfr.`)
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
type OdpowiedzWykazu = {
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

async function pobierz(sciezka: string): Promise<OdpowiedzWykazu | null> {
  const sygnal = AbortSignal.timeout(LIMIT_MS)
  const r = await fetch(`${BAZA}${sciezka}`, { signal: sygnal, headers: { accept: 'application/json' } })
  const tresc = (await r.json().catch(() => null)) as (OdpowiedzWykazu & Record<string, unknown>) | null
  if (!r.ok) {
    const kod = tresc?.message ?? tresc?.code ?? `HTTP ${r.status}`
    throw new BledneWywolanie(`Wykaz odpowiedział błędem: ${kod}`)
  }
  return tresc
}

export type Podmiot = {
  nazwa: string
  nip: string
  statusVat: string
  adres: string | null
  rachunki: string[]
  dataRejestracji: string | null
}

export async function podmiotPoNip(nip: string, data?: string): Promise<Podmiot | null> {
  const d = await pobierz(`/search/nip/${nipCyfry(nip)}?date=${dzien(data)}`)
  const s = d?.result?.subject
  if (!s) return null
  return {
    nazwa: s.name ?? '(bez nazwy)',
    nip: s.nip ?? nipCyfry(nip),
    statusVat: s.statusVat ?? 'nieznany',
    adres: s.workingAddress ?? s.residenceAddress ?? null,
    rachunki: Array.isArray(s.accountNumbers) ? s.accountNumbers : [],
    dataRejestracji: s.registrationLegalDate ?? null,
  }
}

/**
 * Odpowiedź na pytanie, które naprawdę zadaje księgowość: czy TEN rachunek należał
 * do TEGO podatnika w TYM dniu. Zwraca też identyfikator żądania — to on jest dowodem
 * należytej staranności, więc musi wyjść na wierzch, a nie zostać w logu.
 */
export async function rachunekPrzypisany(nip: string, rachunek: string, data?: string) {
  const d = await pobierz(`/check/nip/${nipCyfry(nip)}/bank-account/${rachunekCyfry(rachunek)}?date=${dzien(data)}`)
  const r = d?.result
  return {
    przypisany: r?.accountAssigned === 'TAK',
    surowa: r?.accountAssigned ?? 'nieznane',
    identyfikatorZapytania: r?.requestId ?? null,
    data: dzien(data),
  }
}
