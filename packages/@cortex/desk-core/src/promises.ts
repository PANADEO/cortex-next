import { pairSteps } from "./steps"
import { cardFor, producesFile } from "./tool-cards"
import type { DeskEvent, FileMeta } from "./types"

const EXTENSIONS = "md|csv|tsv|txt|json|xlsx|xls|pdf|docx|png|jpe?g|gif|webp|svg"
const FILE_NAME = new RegExp(String.raw`[\p{L}\p{N}_.()\-]+\.(?:${EXTENSIONS})\b`, "giu")

/** Zdania, w których model przypisuje sobie wytworzenie pliku. */
const PROMISE = /zapis|create|stworz|wygenerow|przygotowa|powsta/i

/**
 * Reguła dowodu obowiązuje TAKŻE PRZECIW tekstowi modelu.
 *
 * Do tej pory dowód mówił wyłącznie o tym, co się wydarzyło; gdy nie wydarzyło się nic,
 * karty przebiegu po prostu nie było — a zdanie „Zapisano dokument malpy.md w teczce sprawy"
 * zostawało na ekranie samo, bez niczego, co by mu zaprzeczyło. Człowiek nie ma jak
 * odróżnić zdania prawdziwego od zmyślonego, więc musi to zrobić za niego aplikacja.
 *
 * Zgłaszamy nazwę pliku tylko wtedy, gdy spełnione są NARAZ trzy warunki: odpowiedź
 * przypisuje sobie wytworzenie pliku, nazwa nie pochodzi z żadnej udanej czynności w tej
 * turze i takiego pliku nie ma w teczce. Trzy warunki, bo cena fałszywego alarmu jest tu
 * wysoka — ostrzeżenie, które myli, przestaje być czytane.
 *
 * CZYNNOŚĆ TO TAKŻE ODCZYT, i to była dziura. Liczone były wyłącznie pliki WYTWORZONE,
 * więc sprawa, w której agent przeczytał `faktury-2026-08.csv` z „Moich plików", policzył
 * i wymienił tę nazwę w odpowiedzi, dostawała ostrzeżenie „Te pliki nie powstały".
 * Panel oskarżał asystenta o zmyślanie dokładnie wtedy, gdy zrobił to, o co go poproszono
 * — a plik z biurka nie leży w teczce sprawy i nie miał jak się tu obronić.
 *
 * Nazwa poparta odczytem jest poparta ZDARZENIEM tak samo jak nazwa poparta zapisem;
 * różnica jest w tym, co się z plikiem stało, a nie w tym, czy istnieje.
 */
export function unbackedPromises(
  text: string,
  turnEvents: DeskEvent[],
  folder: FileMeta[],
): string[] {
  if (!PROMISE.test(text)) return []

  const covered = new Set<string>()
  // Ścieżka z biurka to „Moje pliki/faktury-08.csv", a w tekście pada sama nazwa —
  // porównujemy więc po ostatnim członie.
  const add = (value: string) => covered.add(value.split("/").pop()!.toLowerCase())

  for (const k of pairSteps(turnEvents)) {
    if (k.status !== "ok") continue
    const args = k.args as Record<string, unknown>
    if (producesFile(k.name)) {
      const n = args.name
      if (typeof n === "string") add(n)
    }
    // Ten sam odczyt, na którym stoi dowód: karta mówi, czym czynność jest i co do niej
    // weszło. Bierzemy stąd, a nie z listy nazw narzędzi, żeby narzędzie dołożone za rok
    // — także z obcego serwera — nie musiało pamiętać o dopisaniu się w tym miejscu.
    const card = cardFor(k.name, k.source)
    if (card.kind === "reads" && card.argName) {
      const p = args[card.argName]
      if (typeof p === "string" && p !== "") add(p)
    }
    if (card.inputs) {
      const given = args[card.inputs.arg]
      for (const f of Array.isArray(given) ? given : []) {
        if (typeof f === "string" && f !== "") add(f)
      }
    }
  }
  for (const p of folder) covered.add(p.name.toLowerCase())

  const bez = new Set<string>()
  for (const hit of text.match(FILE_NAME) ?? []) {
    const name = hit.replace(/[.,;:]+$/, "")
    if (!covered.has(name.toLowerCase())) bez.add(name)
  }
  return [...bez]
}

/**
 * Pliki, które w tej turze NAPRAWDĘ powstały — po nazwach z udanych czynności.
 * Rozmowa pokazuje je jako karty, więc lista musi pochodzić ze zdarzeń, nie z tekstu.
 */
export function produced(turnEvents: DeskEvent[]): string[] {
  const names: string[] = []
  for (const k of pairSteps(turnEvents)) {
    if (k.status !== "ok" || !producesFile(k.name)) continue
    const n = (k.args as Record<string, unknown>).name
    if (typeof n === "string" && !names.includes(n)) names.push(n)
  }
  return names
}
