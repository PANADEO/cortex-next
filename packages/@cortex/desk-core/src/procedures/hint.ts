// TRYB `paths` — procedura przypięta do katalogu, płatna dopiero przy dotknięciu.
//
// Wzorzec z OpenHands: reguła doklejana do WYNIKU WYWOŁANIA NARZĘDZIA w chwili, w której
// czynność sięgnęła po pasującą ścieżkę. Koszt bazowy: zero znaków w prompcie.
//
// DOKLEJAMY DO `answer`, NIGDY DO `summary`. To nie jest szczegół: `summary` jest dowodem,
// czyli zdaniem o tym, co się WYDARZYŁO. Podpowiedź nie jest zdarzeniem — jest tekstem dla
// modelu. Wpisana do dowodu byłaby pierwszym wierszem, który nie ma za sobą żadnej czynności.
//
// Wskazówka NIE JEST wykonaniem procedury. Mówi „otwórz ją", a otwarcie zostawia zdarzenie
// i wiersz „Wg czego". Gdyby wskazówka niosła całą treść, procedura wchodziłaby do tury
// BEZ ŚLADU — i to jest dokładnie ta cicha droga, przed którą broni ADR-0001 §4.

import type { StoredProcedure } from "./store"

/**
 * Dopasowanie po PRZEDROSTKU ŚCIEŻKI, z jedną gwiazdką jako „cokolwiek w tym miejscu".
 *
 * Świadomie nie jest to pełny glob. Wzorzec pisze przełożony w przeglądarce, a nie
 * programista: „Moje pliki/Faktury" ma znaczyć to, czego się po nim spodziewa każdy —
 * ten katalog i wszystko w nim. Pełny glob dokładałby reguły (`**` kontra `*`, kropka
 * na początku), których nikt tam nie przeczyta.
 */
export function pathMatches(pattern: string, candidate: string): boolean {
  const p = pattern.trim().replace(/\/+$/, "").toLocaleLowerCase("pl")
  const c = candidate.trim().toLocaleLowerCase("pl")
  if (p === "") return false
  if (!p.includes("*")) return c === p || c.startsWith(`${p}/`)
  const rx = new RegExp(`^${p.split("*").map(escape).join("[^/]*")}(/|$)`, "u")
  return rx.test(c)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Ścieżki, których dotknęła ta czynność — wyciągnięte z ARGUMENTÓW, nie z nazwy narzędzia.
 *
 * Generycznie i z rozmysłu: czynności nazywają swój argument raz `path`, raz `folder`, raz
 * `files`, a czynność dopisana za rok nazwie go jeszcze inaczej. Lista nazw do sprawdzenia
 * byłaby czwartym miejscem, w którym trzeba pamiętać o nowej czynności.
 */
export function touchedPaths(args: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const value of Object.values(args)) {
    if (typeof value === "string") out.push(value)
    else if (Array.isArray(value)) {
      for (const one of value) if (typeof one === "string") out.push(one)
    }
  }
  // Argumenty niosą też zdania (`description`, `query`), a te nie są ścieżkami. Odsiew po
  // ukośniku jest tani i wystarcza: procedura przypięta do katalogu ma w sobie ukośnik.
  return out.filter((one) => one.includes("/"))
}

/**
 * Zdanie doklejane do odpowiedzi dla modelu — albo pusty napis, gdy nic nie pasuje.
 * `already` to procedury otwarte już w tej turze; przypominanie o nich byłoby namawianiem
 * na drugie wywołanie tej samej czynności.
 */
export function hintFor(
  visible: StoredProcedure[],
  args: Record<string, unknown>,
  already: ReadonlySet<string>,
): string {
  const paths = touchedPaths(args)
  if (paths.length === 0) return ""
  const hit = visible.filter(
    (p) =>
      p.loading === "paths" &&
      !already.has(p.name) &&
      p.paths.some((pattern) => paths.some((one) => pathMatches(pattern, one))),
  )
  if (hit.length === 0) return ""
  return hit
    .map(
      (p) =>
        `Do tych plików stosuje się procedura «${p.title}». Otwórz ją czynnością ` +
        `open_procedure (${p.name}), zanim pójdziesz dalej.`,
    )
    .join("\n")
}
