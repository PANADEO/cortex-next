import { createHash } from "node:crypto"

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
const PROSE_KEYWORDS = new Set(["description", "title", "$comment", "examples", "deprecated"])

/** Konstrukcje, których nie umiemy odcisnąć jednoznacznie — narzędzie z nimi jest niezatwierdzalne. */
const FORBIDDEN_KEYWORDS = new Set(["$ref", "$defs", "definitions", "$dynamicRef", "$anchor"])

export class SchemaRejected extends Error {}

/**
 * Zdejmuje ze schematu każdy napis pisany przez dostawcę serwera.
 *
 * To nie jest ostrożność na wyrost: opis narzędzia i opisy pól idą do modelu jako
 * część promptu, więc obcy serwer, który je kontroluje, pisze fragment naszych
 * instrukcji. Opis, który model zobaczy, ma napisać po polsku człowiek zatwierdzający —
 * stąd nie ma tu żadnej ścieżki „przepuść, jeśli wygląda niewinnie".
 */
export function sanitiseSchema(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sanitiseSchema)
  if (x === null || typeof x !== "object") return x

  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (FORBIDDEN_KEYWORDS.has(k)) {
      throw new SchemaRejected(
        `Schemat używa „${k}” — takiego narzędzia nie da się jednoznacznie odcisnąć, więc nie da się go zatwierdzić.`,
      )
    }
    if (PROSE_KEYWORDS.has(k)) continue
    result[k] = sanitiseSchema(v)
  }
  return result
}

/** Postać kanoniczna: klucze posortowane, żeby ten sam schemat zawsze dawał ten sam odcisk. */
export function canonical(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonical).join(",")}]`
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null"
  const pairs = Object.entries(x as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
  return `{${pairs.join(",")}}`
}

/**
 * Odcisk z chwili zatwierdzenia, sprawdzany przy KAŻDEJ rejestracji.
 *
 * Zatwierdzenie dotyczy KONKRETNEGO narzędzia o konkretnym kształcie. Serwer, który
 * po zatwierdzeniu zmieni schemat albo podmieni znaczenie narzędzia, nie może
 * korzystać z wcześniejszej zgody — dlatego odcisk obejmuje też opis, który
 * człowiek zatwierdził, a nie tylko schemat.
 */
export function fingerprint(
  server: string,
  remoteName: string,
  description: string,
  schema: unknown,
): string {
  return createHash("sha256")
    .update([server, remoteName, description, canonical(sanitiseSchema(schema))].join("|"))
    .digest("hex")
}

/**
 * Klucz, pod którym narzędzie trafia do rejestru modelu.
 *
 * Sanityzacja jest konieczna, bo SAMA NAZWA też jest tekstem serwera docierającym
 * do modelu — nazwa w rodzaju `ignore_previous_instructions` nie zniknie przez to,
 * że wycięliśmy opis. Prefiks `mcp_<serwer>_` mówi ludziom i naszemu kodowi,
 * skąd rzecz pochodzi; czyta go `cardFor()` w `tool-cards.ts`.
 */
export function toolKey(server: string, remoteName: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  const s = clean(server)
  const n = clean(remoteName)
  if (!s || !n) throw new SchemaRejected("Nazwa serwera albo narzędzia jest pusta po oczyszczeniu.")
  return `mcp_${s}_${n}`.slice(0, 60)
}
