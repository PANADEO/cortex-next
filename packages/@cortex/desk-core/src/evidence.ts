import type { DeskT } from "@cortex/desk-ui/i18n/locale"
import { capabilityLabel, departmentLabel } from "./capability-text"
import { baseName, pairSteps } from "./steps"
import { cardFor } from "./tool-cards"
import type { DeskEvent } from "./types"

/**
 * JEDEN WIERSZ DOWODU — jedno zdarzenie, nie fragment zdania.
 *
 * Dowód był dotąd listą NAPISÓW, sklejanych na ekranie kropkami w jeden akapit: „co
 * wziąłem" i „co zrobiłem" pod wspólnym słowem „Sprawdzone:", trzynastką, bez jednej
 * rzeczy do kliknięcia. Wzorzec, którego ten ekran potrzebuje, jest znany pani Basi
 * od lat — potwierdzenie z banku: wiersz na zdarzenie, słowo statusu, godzina i obiekt,
 * w który da się wejść.
 *
 * Zdanie (`text`) ZOSTAJE i jest dokładnie to samo, co dotąd: dowód bywa czytany jako
 * proza — w scenariuszach i wszędzie, gdzie nie ma miejsca na tabelę — a wiersz bez
 * słowa statusu (obca usługa) nie ma się czym rozłożyć na części.
 */
export type EvidenceLine = {
  /**
   * Indeks zdarzenia `tool_start` w strumieniu. Stąd ekran bierze GODZINĘ: sam dowód
   * pozostaje czysty — liczy się ze zdarzeń, a nie z zegara — a `AuditEntry.at` zna
   * ten, kto trzyma wpisy dziennika. Ten sam indeks nadaje wierszom kolejność zdarzeń.
   */
  i: number
  /** całe zdanie, tak jak brzmiało, zanim wiersz stał się wierszem */
  text: string
  /**
   * SŁOWO STATUSU — „Przeczytałem", „Zapisałem arkusz". Bierze się z karty (`ok`), czyli
   * z tego samego zdania, którym przebieg opisuje udany krok: drugie słownictwo na tę
   * samą rzecz rozjechałoby się przy pierwszej poprawce. Brak słowa znaczy wiersz,
   * którego nie da się rozłożyć na części — wtedy na ekran idzie całe zdanie.
   */
  word?: string
  /** plik, do którego wiersz prowadzi — nazwa bez ścieżki, taka, jaką zna teczka sprawy */
  file?: string
  /** czym się skończyło: „10 wierszy", „0 pustych pól" */
  detail?: string
}

export type Evidence = {
  intake: EvidenceLine[]
  produced: EvidenceLine[]
  /** piąta lista: co poszło poza to biurko i do kogo — nigdy nie mieszana ze „zrobione" */
  external: EvidenceLine[]
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
  const intake: EvidenceLine[] = []
  const produced: EvidenceLine[] = []
  const external: EvidenceLine[] = []
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
  /** Wytworzone pliki już wypisane — patrz komentarz przy `c.outputs`. */
  const made = new Set<string>()
  const saved = new Set<string>()
  const verified = new Set<string>()

  /**
   * Wiersze „plik po pliku" z jednej listy argumentu. Jedna funkcja dla wejścia i wyniku,
   * bo różnią się wyłącznie zbiorem, do którego trafiają — a dwie kopie tej pętli rozjechałyby
   * się przy pierwszej poprawce odsiewu.
   */
  const fileRows = (
    args: Record<string, unknown>,
    spec: { arg: string; phrase: string; word: string },
    seen: Set<string>,
    into: EvidenceLine[],
    i: number,
  ): number => {
    let added = 0
    const given = args[spec.arg]
    for (const file of Array.isArray(given) ? given : []) {
      if (typeof file !== "string" || file === "" || seen.has(file)) continue
      seen.add(file)
      added += 1
      into.push({
        i,
        text: translate(spec.phrase, { name: file }),
        word: translate(spec.word),
        file: baseName(file),
      })
    }
    return added
  }

  for (const k of pairSteps(events)) {
    const c = cardFor(k.name, k.source)
    /**
     * KROK NIEUDANY ODDAJE DOWODOWI TYLKO TO, CO NAPRAWDĘ ZOSTAWIŁ — czyli pliki.
     *
     * Do 03.09.2026 stało tu `if (k.status !== "ok") continue` przed wszystkim, i było to
     * słuszne wobec zdań: krok, który padł, nie „przeczytał" ani nie „zapisał", a wiersz
     * mówiący, że to zrobił, byłby nieprawdą.
     *
     * Ale `run_computation` zabiera pliki z piaskownicy TAKŻE po nieudanym obliczeniu, i to
     * jest tam decyzja zapisana wprost: skrypt, który zapisał trzy arkusze z pięciu i
     * przewrócił się na czwartym, zostawił trzy PRAWDZIWE pliki. Leżą w teczce sprawy, widać
     * je w panelu wyniku, model o nich mówi — a „Co powstało" milczało, bo ten warunek ucinał
     * cały krok pięć bloków wcześniej. Cicha strata dokładnie tam, gdzie `runtime.ts` włożył
     * wysiłek, żeby jej nie było.
     *
     * Wiersz nie kłamie: krok stoi obok w przebiegu z krzyżykiem i powodem, a plik istnieje.
     * Zdania kroku (`c.evidence`) nadal NIE wchodzą — tamte mówiłyby o czynności, która się
     * nie udała.
     */
    if (k.status !== "ok") {
      if (c.outputs) fileRows(k.args as Record<string, unknown>, c.outputs, made, produced, k.i)
      continue
    }
    // `unknown`, a nie `string`: argumenty narzędzi niosą też LISTY (pliki wchodzące do
    // piaskownicy), a rzutowanie na `Record<string, string>` było wtedy zapewnieniem
    // nieprawdziwym — kompilator przestawał pilnować akurat tego miejsca, w którym
    // wartość nie jest napisem.
    const a = k.args as Record<string, unknown>
    const name = c.argName && typeof a[c.argName] === "string" ? (a[c.argName] as string) : ""

    // Odczyt Z BIURKA, nie z dowolnego źródła: na tym stoi zdanie o dokumencie,
    // który powstał bez zajrzenia do choćby jednego pliku tej osoby.
    if (c.kind === "reads" && name) fromDesk.add(name)
    if (c.kind === "produces" && c.verifiable && name) saved.add(name)
    if (c.kind === "verifies" && name) verified.add(name)

    // Pliki, które weszły do sprawy jako DANE — np. zamontowane w piaskownicy. Karmią ten
    // sam zbiór co odczyt, bo na nim stoi zdanie o dokumencie powstałym bez zajrzenia do
    // czegokolwiek; pomijamy plik już policzony, żeby ta sama faktura nie pojawiła się
    // w „Co weszło" dwa razy dlatego, że agent liczył na niej dwukrotnie.
    if (c.inputs) fileRows(a, c.inputs, fromDesk, intake, k.i)

    // Pliki WYTWORZONE — po wierszu na plik, lustrzanie do bloku wyżej. Kolejność ta sama,
    // co w „Co weszło": najpierw rzeczy, potem zdanie podsumowujące krok.
    //
    // Zbiór `made` pilnuje, żeby ten sam plik nie stanął w „Co powstało" dwa razy, gdy
    // agent policzył go w dwóch turach — z tego samego powodu, dla którego `fromDesk`
    // pilnuje wejścia. Tu jednak NIE odejmujemy od `fromDesk`: plik może najpierw wejść
    // jako dane, a potem powstać na nowo, i obie te rzeczy naprawdę się wydarzyły.
    const wroteRows = c.outputs ? fileRows(a, c.outputs, made, produced, k.i) : 0

    /**
     * ZDANIE PODSUMOWUJĄCE KROK ODPADA, GDY NAD NIM STOJĄ NAZWY.
     *
     * Karta czynności ma już własny nagłówek („✓ Policzyłem · 2 s"), więc przy wypisanych
     * plikach wiersz „policzono — policzone, plików: 4" mówił po raz TRZECI to samo, i to
     * akurat tą liczbą, którą cała ta zmiana miała zastąpić nazwami. Gdy piaskownica nic nie
     * wytworzyła, zdanie zostaje — bo jest wtedy jedynym śladem, że obliczenie się odbyło.
     */
    if (wroteRows > 0) continue
    if (!c.evidence) continue
    const detail = k.summary ?? ""
    // Bez szczegółu bierzemy krótszy wariant zdania, jeśli karta go ma.
    const phrase = detail === "" ? (c.evidence.phraseBare ?? c.evidence.phrase) : c.evidence.phrase
    const line: EvidenceLine = {
      i: k.i,
      text: translate(phrase, {
        ...c.vars,
        name,
        detail,
        // Etykietę pisze nasz kod przy wywołaniu; gdy jej nie ma, zostaje nazwa rzeczy.
        label: k.label || name,
        source: c.source,
      }),
      // Wiersz obcej usługi ZOSTAJE zdaniem i to nie jest zaniedbanie: jego obiektem nie
      // jest plik, w który da się wejść, tylko pytanie zadane na zewnątrz — a odpowiedź
      // stamtąd znaczy „serwer odpowiedział", nie „rzecz się wydarzyła". Rozłożony na
      // słowo i obiekt wyglądałby jak wiersze obok, które mówią o rzeczach zrobionych.
      ...(c.kind === "external"
        ? {}
        : { word: translate(c.ok, c.vars), ...(name ? { file: baseName(name) } : {}) }),
      ...(detail === "" ? {} : { detail }),
    }
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
