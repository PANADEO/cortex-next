import type { DeskT } from "@cortex/desk-ui/i18n/locale"
import { capabilityLabel, departmentLabel } from "./capability-text"
import { pairSteps } from "./steps"
import { cardFor } from "./tool-cards"
import type { DeskEvent } from "./types"

export type Evidence = {
  intake: string[]
  produced: string[]
  /** piąta lista: co poszło poza to biurko i do kogo — nigdy nie mieszana ze „zrobione" */
  external: string[]
  unverified: string[]
  notAllowed: string[]
  /**
   * To samo, co wyżej, ale JAKO DANE — nazwy plików zapisanych i odczytanych po zapisie.
   *
   * Panel wyniku wnioskował plakietkę „sprawdzony" z DOPASOWANIA NAPISU do zdania
   * `odczytano … po zapisie`. Działało to dopóki zdanie było jedno i po polsku;
   * pierwsze tłumaczenie zabrałoby plakietkę bez jednego błędu, a plakietka jest tu
   * całym dowodem. Zdania zostają do czytania, decyzje podejmuje się na tych listach.
   */
  files: { saved: string[]; verified: string[] }
}

/**
 * Dowód powstaje WYŁĄCZNIE ze zdarzeń narzędzi. Nigdy z tekstu modelu.
 * Krok bez odpowiadającego mu `tool_end` się nie liczy.
 *
 * O tym, do której listy trafia czynność i jakim zdaniem, decyduje jej karta.
 * Wcześniej stało tu siedem `if (k.nazwa === ...)` bez gałęzi domyślnej — narzędzie
 * spoza tej siódemki nie zostawiało ANI JEDNEGO wiersza, więc panel wyglądał tak,
 * jakby agent nic nie zrobił. Dla wbudowanych to nie miało znaczenia; dla pierwszego
 * serwera MCP oznaczałoby ciche zniknięcie jedynej rzeczy, którą ten produkt obiecuje.
 */
export function evidenceFromEvents(events: DeskEvent[], translate: DeskT): Evidence {
  const intake: string[] = []
  const produced: string[] = []
  const external: string[] = []
  const unverified: string[] = []
  // czwarta lista: rzeczy, których agent nie zrobił nie dlatego, że nie umiał,
  // tylko dlatego, że ta osoba nie ma na nie zgody
  const notAllowed = events
    .filter((e): e is Extract<DeskEvent, { type: "blocked" }> => e.type === "blocked")
    .map((e) => {
      // Nazwa zdolności powstaje z jej TOŻSAMOŚCI; `e.name` niosą wyłącznie zdarzenia
      // zapisane, zanim katalog przestał nosić słowa.
      const name = capabilityLabel(translate, e.capabilityId, e.name ?? "")
      return name
        ? translate("evidence.blockedNamed", {
            description: e.description,
            name,
            department: departmentLabel(translate, e.department),
          })
        : e.description
    })

  const fromDesk = new Set<string>()
  const saved = new Set<string>()
  const verified = new Set<string>()

  for (const k of pairSteps(events)) {
    if (k.status !== "ok") continue
    const c = cardFor(k.name, k.source)
    const a = k.args as Record<string, string>
    const name = c.argName ? (a[c.argName] ?? "") : ""

    // Odczyt Z BIURKA, nie z dowolnego źródła: na tym stoi zdanie o dokumencie,
    // który powstał bez zajrzenia do choćby jednego pliku tej osoby.
    if (c.kind === "reads" && name) fromDesk.add(name)
    if (c.kind === "produces" && c.verifiable && name) saved.add(name)
    if (c.kind === "verifies" && name) verified.add(name)

    if (!c.evidence) continue
    const detail = k.summary ?? ""
    // Bez szczegółu bierzemy krótszy wariant zdania, jeśli karta go ma.
    const phrase = detail === "" ? (c.evidence.phraseBare ?? c.evidence.phrase) : c.evidence.phrase
    const line = translate(phrase, {
      ...c.vars,
      name,
      detail,
      // Etykietę pisze nasz kod przy wywołaniu; gdy jej nie ma, zostaje nazwa rzeczy.
      label: k.label || name,
      source: c.source,
    })
    if (c.evidence.list === "intake") intake.push(line)
    else if (c.evidence.list === "external") external.push(line)
    else produced.push(line)
  }

  // Reguła: zapisany dokument, którego nikt nie odczytał po zapisie, jest NIESPRAWDZONY.
  for (const n of saved) {
    if (!verified.has(n)) unverified.push(translate("evidence.unverifiedFile", { name: n }))
  }
  if (saved.size > 0 && fromDesk.size === 0) {
    unverified.push(translate("evidence.noIntake"))
  }
  return {
    intake,
    produced,
    external,
    unverified,
    notAllowed,
    files: { saved: [...saved], verified: [...verified] },
  }
}
