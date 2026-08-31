import { createHash } from 'node:crypto'

/**
 * HIGIENA MCP — wszystko, co trzeba zrobić z tym, co przysłał obcy serwer,
 * ZANIM cokolwiek z tego dotknie modelu albo rejestru narzędzi.
 *
 * Moduł jest czysty i osobny od klienta, bo to jedyna część warstwy MCP,
 * którą da się sprawdzić testem bez stawiania serwera — a jest to zarazem
 * jedyna część, w której błąd nie objawia się awarią, tylko zmianą zachowania
 * agenta u klienta.
 */

/** Klucze, którymi serwer wstrzykuje TEKST do promptu modelu. Wycinamy wszystkie. */
const TEKSTOWE = new Set(['description', 'title', '$comment', 'examples', 'deprecated'])

/** Konstrukcje, których nie umiemy odcisnąć jednoznacznie — narzędzie z nimi jest niezatwierdzalne. */
const NIEDOPUSZCZALNE = new Set(['$ref', '$defs', 'definitions', '$dynamicRef', '$anchor'])

export class SchematOdrzucony extends Error {}

/**
 * Zdejmuje ze schematu każdy napis pisany przez dostawcę serwera.
 *
 * To nie jest ostrożność na wyrost: opis narzędzia i opisy pól idą do modelu jako
 * część promptu, więc obcy serwer, który je kontroluje, pisze fragment naszych
 * instrukcji. Opis, który model zobaczy, ma napisać po polsku człowiek zatwierdzający —
 * stąd nie ma tu żadnej ścieżki „przepuść, jeśli wygląda niewinnie".
 */
export function oczyscSchemat(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(oczyscSchemat)
  if (x === null || typeof x !== 'object') return x

  const wynik: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (NIEDOPUSZCZALNE.has(k)) {
      throw new SchematOdrzucony(
        `Schemat używa „${k}" — takiego narzędzia nie da się jednoznacznie odcisnąć, więc nie da się go zatwierdzić.`,
      )
    }
    if (TEKSTOWE.has(k)) continue
    wynik[k] = oczyscSchemat(v)
  }
  return wynik
}

/** Postać kanoniczna: klucze posortowane, żeby ten sam schemat zawsze dawał ten sam odcisk. */
export function kanoniczny(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(kanoniczny).join(',')}]`
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null'
  const pary = Object.entries(x as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${kanoniczny(v)}`)
  return `{${pary.join(',')}}`
}

/**
 * Odcisk z chwili zatwierdzenia, sprawdzany przy KAŻDEJ rejestracji.
 *
 * Zatwierdzenie dotyczy KONKRETNEGO narzędzia o konkretnym kształcie. Serwer, który
 * po zatwierdzeniu zmieni schemat albo podmieni znaczenie narzędzia, nie może
 * korzystać z wcześniejszej zgody — dlatego odcisk obejmuje też opis, który
 * człowiek zatwierdził, a nie tylko schemat.
 */
export function odcisk(serwer: string, nazwaZdalna: string, opis: string, schemat: unknown): string {
  return createHash('sha256')
    .update([serwer, nazwaZdalna, opis, kanoniczny(oczyscSchemat(schemat))].join('|'))
    .digest('hex')
}

/**
 * Klucz, pod którym narzędzie trafia do rejestru modelu.
 *
 * Sanityzacja jest konieczna, bo SAMA NAZWA też jest tekstem serwera docierającym
 * do modelu — nazwa w rodzaju `ignore_previous_instructions` nie zniknie przez to,
 * że wycięliśmy opis. Prefiks `mcp_<serwer>_` mówi ludziom i naszemu kodowi,
 * skąd rzecz pochodzi; czyta go `karta()` w `core/narzedzia.ts`.
 */
export function kluczNarzedzia(serwer: string, nazwaZdalna: string): string {
  const czysty = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const s = czysty(serwer)
  const n = czysty(nazwaZdalna)
  if (!s || !n) throw new SchematOdrzucony('Nazwa serwera albo narzędzia jest pusta po oczyszczeniu.')
  return `mcp_${s}_${n}`.slice(0, 60)
}
