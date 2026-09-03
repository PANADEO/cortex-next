import type { DeskT } from "@cortex/desk-ui/i18n/locale"
import { cardFor, type ToolCard, type ToolClass, type ToolGroup } from "./tool-cards"
import type { DeskEvent, StepFailure } from "./types"

/** Jeden krok pracy agenta: wywołanie narzędzia razem z jego wynikiem. */
export type Step = {
  /** indeks zdarzenia `narzedzie_start` w strumieniu — pozwala odtworzyć czas i kolejność */
  i: number
  name: string
  label: string
  args: Record<string, unknown>
  /** nazwa źródła dla człowieka, gdy czynność przyszła spoza tego repozytorium */
  source?: string
  status: "running" | "ok" | "failed"
  summary?: string
  ms?: number
  /** powód niepowodzenia; przy kroku udanym i w toku go nie ma */
  reason?: StepFailure
}

/**
 * Paruje `narzedzie_start` z `narzedzie_koniec`.
 *
 * Model może w jednym kroku wywołać kilka narzędzi naraz, więc ich zdarzenia potrafią się
 * przepleść — parujemy po `id`. Zdarzenia sprzed wprowadzenia `id` parujemy pozycyjnie,
 * czyli tak, jak działało to wcześniej.
 */
export function pairSteps(events: DeskEvent[]): Step[] {
  const steps: Step[] = []
  const byId = new Map<string, Step>()
  const bezId: Step[] = []

  // `entries()`, a nie indeksowanie: pod `noUncheckedIndexedAccess` `zdarzenia[i]` ma typ
  // `DeskEvent | undefined`, a to gasi rozróżnianie wariantu po `typ` — kompilator przestaje
  // widzieć `e.nazwa` na starcie narzędzia. Iterator oddaje element bez tego `undefined`.
  for (const [i, e] of events.entries()) {
    if (e.type === "tool_start") {
      const k: Step = {
        i,
        name: e.name,
        label: e.label,
        args: e.args,
        status: "running",
        ...(e.source === undefined ? {} : { source: e.source }),
      }
      steps.push(k)
      if (e.id) byId.set(e.id, k)
      else bezId.push(k)
      continue
    }

    if (e.type === "tool_end") {
      const k = e.id ? byId.get(e.id) : bezId.shift()
      if (!k) continue
      k.status = e.ok ? "ok" : "failed"
      // Pola opcjonalne przypisujemy tylko wtedy, gdy naprawdę przyszły: `exactOptionalPropertyTypes`
      // odróżnia „klucza nie ma" od „klucz jest i ma wartość undefined", a drugie nie jest tym,
      // co chcemy wpisać do kroku.
      if (e.summary !== undefined) k.summary = e.summary
      if (e.ms !== undefined) k.ms = e.ms
      if (e.reason !== undefined) k.reason = e.reason
      // Argumenty dopisane po fakcie dołączają do tych z otwarcia kroku, zamiast żyć obok.
      // Czym plik jest dla sprawy, nie zależy od tego, KIEDY czynność poznała jego nazwę —
      // a dowód i strażnik obietnic pytają o pliki w jednym miejscu i mają tak zostać.
      if (e.discovered) k.args = { ...k.args, ...e.discovered }
      if (e.id) byId.delete(e.id)
    }
  }
  return steps
}

/** Nazwa pliku bez ścieżki — w tytule kroku pokazujemy sam plik, ścieżka schodzi do szczegółu. */
function baseName(s: string) {
  return s.split("/").filter(Boolean).pop() ?? s
}

/**
 * `?: T | undefined`, a nie samo `?: T`. Pod `exactOptionalPropertyTypes` to dwie różne
 * rzeczy, a tutaj naprawdę chodzi o tę drugą: opis kroku powstaje jednym literałem, w
 * którym człon nieobecny jest po prostu `undefined` — rozróżnianie „klucza nie ma" od
 * „klucz jest pusty" nie niesie tu żadnej informacji, a wymusza gimnastykę przy każdym
 * budowaniu obiektu.
 */
export type StepText = {
  title: string
  file?: string | undefined
  path?: string | undefined
  detail?: string | undefined
}

/**
 * Zamienia krok na zdanie. W toku — niedokonany, po zakończeniu — dokonany:
 * „Zapisuję zestawienie" w trakcie, „Zapisałem zestawienie" po. Bez tego zakończona
 * sprawa opowiada w czasie teraźniejszym o czymś, co już się stało.
 *
 * Czasowniki i argumenty biorą się z karty narzędzia, nie z `switch` po nazwach —
 * dzięki temu narzędzie z serwera MCP dostaje zdanie, a nie surowy klucz.
 *
 * Zdanie powstaje TUTAJ, przy renderze, a nie przy zapisie zdarzenia — dlatego funkcja
 * przyjmuje tłumacza. Ta sama sprawa czyta się wtedy w obu językach, a dziennik nie
 * musi być przepisywany wstecz.
 */
/**
 * Który klucz karty niesie tytuł w danym stanie. Mapa, a nie warunek w wyrażeniu:
 * stan kroku ma trzy wartości i kompilator ma pilnować, że każda z nich ma swoje zdanie.
 * Warunek trójargumentowy tego nie robi — i właśnie dlatego przez cały czas mieścił
 * dwa stany w miejscu na trzy.
 */
const TITLE_BY_STATUS: Record<Step["status"], (c: ToolCard) => string> = {
  running: (c) => c.running,
  ok: (c) => c.ok,
  failed: (c) => c.failed,
}

export function describeStep(k: Step, translate: DeskT): StepText {
  const a = k.args as Record<string, string>
  const c = cardFor(k.name, k.source)
  const nameFromArg = c.argName ? a[c.argName] : undefined
  const file = nameFromArg ? baseName(nameFromArg) : undefined
  const path = c.argPath ? a[c.argPath] : undefined
  const detail = k.summary ?? (c.argDetail ? a[c.argDetail] : undefined)
  const vars = { ...c.vars, name: file ?? "", path: path ?? "", detail: detail ?? "" }
  return {
    // Trzy stany, trzy zdania. Wcześniej stało tu `w toku ? running : ok`, czyli krok,
    // który PADŁ, dostawał zdanie sukcesu — „Zapisałem arkusz" nad czynnością, po której
    // arkusza nie ma. To było jedyne miejsce w produkcie, w którym ekran mówił nieprawdę.
    title: translate(TITLE_BY_STATUS[k.status](c), vars),
    file,
    path,
    // etykieta jest NASZA — pisze ją nasz kod przy wywołaniu, nigdy obcy serwer
    detail: c.kind === "external" ? (detail ?? k.label) : detail,
  }
}

/** Ile trwał krok, po ludzku: poniżej sekundy nie mówimy nic. */
export function stepDuration(ms?: number): string | null {
  if (ms == null || ms < 1000) return null
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`
}

/**
 * Jedno zdanie o całej grupie — to, co widać po zwinięciu przebiegu.
 * Liczymy czynności, nie kroki modelu: „przeczytałem 1 plik i zapisałem 1 dokument".
 *
 * Człony biorą się z kart. Dwa narzędzia o tym samym kluczu grupy sumują się w jeden
 * człon (dokument i arkusz to dla człowieka ta sama rzecz), a karta bez `group`
 * świadomie nie wchodzi do zdania.
 */
export function summariseGroup(steps: Step[], translate: DeskT): string {
  const produced = steps.filter((k) => k.status === "ok")

  const by = new Map<string, { g: ToolGroup; n: number; vars: Record<string, string> }>()
  for (const k of produced) {
    const c = cardFor(k.name, k.source)
    if (!c.group) continue
    const before = by.get(c.group.key)
    if (before) before.n += 1
    else by.set(c.group.key, { g: c.group, n: 1, vars: { ...c.vars } })
  }

  // waga rośnie z wagą informacji; kolejność w zdaniu idzie od najlżejszego,
  // czyli tak, jak człowiek pracuje: najpierw rozejrzenie, na końcu wynik
  const parts = [...by.values()]
    .map(({ g, n, vars }) => ({
      text: translate(g.phrase, { ...vars, count: n }),
      weight: g.weight,
    }))
    .sort((a, b) => a.weight - b.weight)

  if (!parts.length) {
    return produced.length
      ? translate("trail.summaryPlain", { count: produced.length })
      : translate("trail.summaryNothing")
  }

  // trzy człony to granica czytelności jednym rzutem oka; przy nadmiarze odpadają
  // najpierw człony najmniej niosące, nigdy powstały dokument
  const selected = [...parts]
  while (selected.length > 3) {
    let najsl = 0
    for (let i = 1; i < selected.length; i++)
      if (selected[i]!.weight < selected[najsl]!.weight) najsl = i
    selected.splice(najsl, 1)
  }
  const skipped = parts.length - selected.length
  const t = selected.map((c) => c.text)
  // jeden pominięty człon i tak był najmniej ważny — dopisek „i 1 inną czynność" to sam szum
  if (skipped > 1) t.push(translate("trail.summaryOther", { count: skipped }))

  // Spójnik przed ostatnim członem jest częścią JĘZYKA, nie kodu — polskie „i" i angielskie
  // „and" akurat stoją w tym samym miejscu, ale zakładanie tego na stałe to ta sama pomyłka,
  // co sklejanie liczebnika z rzeczownikiem w kodzie.
  const sentence =
    t.length === 1
      ? t[0]!
      : translate("trail.summaryJoin", {
          head: t.slice(0, -1).join(", "),
          last: t[t.length - 1] ?? "",
        })
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

/**
 * TRZY ZDANIA KROKU, KTÓRY SIĘ NIE UDAŁ — zawsze w tej samej kolejności.
 *
 *   1. CO SIĘ STAŁO       — z POWODU zapisanego w zdarzeniu
 *   2. CZY COŚ SIĘ ZMIENIŁO — z KLASY czynności, czyli z tego, co ona robi ze światem
 *   3. CO TERAZ            — z POWODU, nigdy z nazwy narzędzia
 *
 * Środkowe jest najważniejsze i dlatego jest osobnym polem, a nie doklejką do pierwszego.
 * Najgorszy błąd, jaki ten ekran może popełnić, to taki, po którym człowiek nie wie, czy
 * coś się już wydarzyło — czy arkusz powstał do połowy, czy plik został nadpisany, czy
 * obca strona zdążyła coś zrobić. Dopóki tej odpowiedzi nie ma, jedyne bezpieczne
 * zachowanie to nie ruszać niczego, a to jest gorsze niż zła wiadomość.
 *
 * DLACZEGO ZDANIE DRUGIE BIERZE SIĘ Z KLASY, A NIE Z POWODU. Powód mówi, dlaczego się
 * nie udało; o tym, co czynność mogła zdążyć zmienić, mówi wyłącznie to, czym czynność
 * jest. Odczyt nie ma czego zepsuć niezależnie od powodu; zapis, który padł, nie zostawia
 * pliku; a czynność obcego serwera — cokolwiek jej się stało — mogła po tamtej stronie
 * przejść. Jedyny wyjątek to powody, po których NIE WIEMY, czy czynność w ogóle dobiegła
 * do końca; wtedy klasa też nic nie mówi i trzeba to powiedzieć wprost.
 */
export type FailureText = { happened: string; changed: string; next: string }

/** Skończona lista powodów — jedno miejsce, z którego czyta ją i kod, i test słownika. */
export const STEP_FAILURES = [
  "interrupted",
  "no-access",
  "no-such-file",
  "cannot-open",
  "wrong-kind",
  "cannot-recognise",
  "cannot-save",
  "computation-error",
  "computation-stopped",
  "outside-service",
  "unknown",
] as const satisfies readonly StepFailure[]

/**
 * Powody, po których nie wiemy, czy czynność zdążyła cokolwiek zmienić.
 * Zdanie drugie mówi wtedy „nie wiem", a nie „nic się nie stało" — bo to drugie
 * byłoby zapewnieniem bez pokrycia, czyli tym samym grzechem, co tytuł sukcesu
 * nad krokiem, który padł.
 */
const UNCERTAIN_EFFECT: readonly StepFailure[] = ["interrupted"]

/** CO SIĘ STAŁO — jedno zdanie na powód. */
const HAPPENED: Record<StepFailure, string> = {
  interrupted: "trail.failure.happened.interrupted",
  "no-access": "trail.failure.happened.noAccess",
  "no-such-file": "trail.failure.happened.noSuchFile",
  "cannot-open": "trail.failure.happened.cannotOpen",
  "wrong-kind": "trail.failure.happened.wrongKind",
  "cannot-recognise": "trail.failure.happened.cannotRecognise",
  "cannot-save": "trail.failure.happened.cannotSave",
  "computation-error": "trail.failure.happened.computationError",
  "computation-stopped": "trail.failure.happened.computationStopped",
  "outside-service": "trail.failure.happened.outsideService",
  unknown: "trail.failure.happened.unknown",
}

/**
 * CO TERAZ — rad jest MNIEJ niż powodów i to nie jest niedbałość.
 * Różne rzeczy potrafią się popsuć tak, że wyjście jest to samo; udawanie, że każda
 * awaria ma własną radę, dałoby jedenaście wariantów tego samego zdania. `tryAgain`
 * jest tu zdaniem bezpiecznym: nie obiecuje, że zadziała, i nie zwala winy na człowieka.
 */
const NEXT: Record<StepFailure, string> = {
  interrupted: "trail.failure.next.lookInFolder",
  "no-access": "trail.failure.next.askForAccess",
  "no-such-file": "trail.failure.next.checkTheName",
  "cannot-open": "trail.failure.next.tryAgain",
  "wrong-kind": "trail.failure.next.anotherFile",
  "cannot-recognise": "trail.failure.next.pasteTheFragment",
  "cannot-save": "trail.failure.next.tryAgain",
  "computation-error": "trail.failure.next.describeMorePrecisely",
  "computation-stopped": "trail.failure.next.smallerPortion",
  "outside-service": "trail.failure.next.tryAgain",
  unknown: "trail.failure.next.tryAgain",
}

/** CZY COŚ SIĘ ZMIENIŁO — jedno zdanie na klasę czynności. */
const CHANGED: Record<ToolClass, string> = {
  browses: "trail.failure.changed.browses",
  reads: "trail.failure.changed.reads",
  produces: "trail.failure.changed.produces",
  verifies: "trail.failure.changed.verifies",
  computes: "trail.failure.changed.computes",
  stores: "trail.failure.changed.stores",
  external: "trail.failure.changed.external",
}

/** Gdy nie wiadomo, czy czynność dobiegła do końca — klasa też nic nie mówi. */
const CHANGED_UNKNOWN = "trail.failure.changed.unknown"

/**
 * Zdanie bezpieczne dla kroku, który padł bez zapisanego powodu. Ma dwa źródła i oba
 * są realne: sprawy zapisane przed wprowadzeniem pola `reason` oraz narzędzia z serwerów
 * MCP, których opakowywacz powodu jeszcze nie wpisuje.
 */
const NO_REASON: StepFailure = "unknown"

/**
 * `approver` — „Imię Nazwisko" osoby, która w tej firmie wydaje zgody; pusto, gdy Biurko
 * nie umie jej wskazać. Bierze się stąd, że zdanie „co teraz" nie może kończyć się
 * BEZIMIENNYM adresatem. Pierwsza wersja tego kodu odsyłała do „administratora" i to był
 * ten sam ślepy zaułek, który zamykamy przy kłódce — tylko przeniesiony o jeden ekran.
 * Pani Basia nie wie, kto to administrator, i nie ma jak go zapytać.
 */
export function describeFailure(
  k: Step,
  translate: DeskT,
  approver?: string,
): FailureText | null {
  if (k.status !== "failed") return null
  const reason = k.reason ?? NO_REASON
  const c = cardFor(k.name, k.source)
  const changed = UNCERTAIN_EFFECT.includes(reason) ? CHANGED_UNKNOWN : CHANGED[c.kind]
  // Wariant z imieniem wyłącznie tam, gdzie zdanie i tak kogoś przywołuje. Konstrukcja
  // „swojemu przełożonemu: Robert Nowak" omija odmianę polskiego imienia — dopełniacz
  // i celownik wymagałyby słownika fleksyjnego, którego tu nie ma i nie będzie.
  const next =
    NEXT[reason] === "trail.failure.next.tryAgain" && approver
      ? translate("trail.failure.next.tryAgainTell", { person: approver })
      : translate(NEXT[reason])
  return {
    happened: translate(HAPPENED[reason]),
    changed: translate(changed, { ...c.vars }),
    next: next,
  }
}
