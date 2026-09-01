import { paruj } from "./kroki"
import { karta } from "./narzedzia"
import type { DeskEvent } from "./typy"

export type Dowod = {
  weszlo: string[]
  zrobione: string[]
  /** piąta lista: co poszło poza to biurko i do kogo — nigdy nie mieszana ze „zrobione" */
  zewnetrzne: string[]
  nieSprawdzone: string[]
  niewolno: string[]
}

/**
 * Dowód powstaje WYŁĄCZNIE ze zdarzeń narzędzi. Nigdy z tekstu modelu.
 * Krok bez odpowiadającego mu `narzedzie_koniec` się nie liczy.
 *
 * O tym, do której listy trafia czynność i jakim zdaniem, decyduje jej karta.
 * Wcześniej stało tu siedem `if (k.nazwa === ...)` bez gałęzi domyślnej — narzędzie
 * spoza tej siódemki nie zostawiało ANI JEDNEGO wiersza, więc panel wyglądał tak,
 * jakby agent nic nie zrobił. Dla wbudowanych to nie miało znaczenia; dla pierwszego
 * serwera MCP oznaczałoby ciche zniknięcie jedynej rzeczy, którą ten produkt obiecuje.
 */
export function dowodZeZdarzen(zdarzenia: DeskEvent[]): Dowod {
  const weszlo: string[] = []
  const zrobione: string[] = []
  const zewnetrzne: string[] = []
  const nieSprawdzone: string[] = []
  // czwarta lista: rzeczy, których agent nie zrobił nie dlatego, że nie umiał,
  // tylko dlatego, że ta osoba nie ma na nie zgody
  const niewolno = zdarzenia
    .filter((e): e is Extract<DeskEvent, { typ: "zablokowane" }> => e.typ === "zablokowane")
    .map((e) => (e.nazwa ? `${e.opis} — wymaga zdolności „${e.nazwa}” (dział ${e.dzial})` : e.opis))

  const zBiurka = new Set<string>()
  const zapisane = new Set<string>()
  const sprawdzone = new Set<string>()

  for (const k of paruj(zdarzenia)) {
    if (k.stan !== "ok") continue
    const c = karta(k.nazwa, k.zrodlo)
    const a = k.argumenty as Record<string, string>
    const nazwa = c.argNazwa ? (a[c.argNazwa] ?? "") : ""

    // Odczyt Z BIURKA, nie z dowolnego źródła: na tym stoi zdanie o dokumencie,
    // który powstał bez zajrzenia do choćby jednego pliku tej osoby.
    if (c.klasa === "czyta" && nazwa) zBiurka.add(nazwa)
    if (c.klasa === "wytwarza" && c.sprawdzalny && nazwa) zapisane.add(nazwa)
    if (c.klasa === "sprawdza" && nazwa) sprawdzone.add(nazwa)

    if (!c.dowod) continue
    const wiersz = c.dowod.fraza(nazwa, k.podsumowanie ?? "", {
      etykieta: k.etykieta,
      zrodlo: c.zrodlo,
    })
    if (c.dowod.lista === "weszlo") weszlo.push(wiersz)
    else if (c.dowod.lista === "zewnetrzne") zewnetrzne.push(wiersz)
    else zrobione.push(wiersz)
  }

  // Reguła: zapisany dokument, którego nikt nie odczytał po zapisie, jest NIESPRAWDZONY.
  for (const n of zapisane) {
    if (!sprawdzone.has(n)) nieSprawdzone.push(`zawartość pliku ${n} po zapisie`)
  }
  if (zapisane.size > 0 && zBiurka.size === 0) {
    nieSprawdzone.push("dokument powstał bez odczytania choćby jednego pliku z biurka")
  }
  return { weszlo, zrobione, zewnetrzne, nieSprawdzone, niewolno }
}
