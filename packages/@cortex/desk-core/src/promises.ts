import { pairSteps } from "./steps"
import { producesFile } from "./tool-cards"
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
 */
export function unbackedPromises(
  text: string,
  turnEvents: DeskEvent[],
  folder: FileMeta[],
): string[] {
  if (!PROMISE.test(text)) return []

  const covered = new Set<string>()
  for (const k of pairSteps(turnEvents)) {
    if (k.status !== "ok" || !producesFile(k.name)) continue
    const n = (k.args as Record<string, unknown>).name
    if (typeof n === "string") covered.add(n.toLowerCase())
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
