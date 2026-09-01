import { cardFor, type ToolGroup } from "./tool-cards"
import type { DeskEvent } from "./types"

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
 * Zamienia krok na zdanie po polsku. W toku — niedokonany, po zakończeniu — dokonany:
 * „Zapisuję zestawienie" w trakcie, „Zapisałem zestawienie" po. Bez tego zakończona
 * sprawa opowiada w czasie teraźniejszym o czymś, co już się stało.
 *
 * Czasowniki i argumenty biorą się z karty narzędzia, nie z `switch` po nazwach —
 * dzięki temu narzędzie z serwera MCP dostaje zdanie, a nie surowy klucz.
 */
export function describeStep(k: Step): StepText {
  const a = k.args as Record<string, string>
  const c = cardFor(k.name, k.source)
  const nameFromArg = c.argName ? a[c.argName] : undefined
  const file = nameFromArg ? baseName(nameFromArg) : undefined
  const path = c.argPath ? a[c.argPath] : undefined
  const detail = k.summary ?? (c.argDetail ? a[c.argDetail] : undefined)
  return {
    title: k.status === "running" ? c.running : c.ok,
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
export function summariseGroup(steps: Step[]): string {
  const count = (n: number, j: string, k: string, w: string) => {
    const d = n % 10,
      s = n % 100
    if (n === 1) return `${n} ${j}`
    if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} ${k}`
    return `${n} ${w}`
  }
  const produced = steps.filter((k) => k.status === "ok")

  const by = new Map<string, { g: ToolGroup; n: number }>()
  for (const k of produced) {
    const g = cardFor(k.name, k.source).group
    if (!g) continue
    const before = by.get(g.key)
    if (before) before.n += 1
    else by.set(g.key, { g, n: 1 })
  }

  // waga rośnie z wagą informacji; kolejność w zdaniu idzie od najlżejszego,
  // czyli tak, jak człowiek pracuje: najpierw rozejrzenie, na końcu wynik
  const parts = [...by.values()]
    .map(({ g, n }) => ({
      text: [g.verb, g.countable ? count(n, ...g.countable) : null, g.suffix]
        .filter(Boolean)
        .join(" "),
      weight: g.weight,
    }))
    .sort((a, b) => a.weight - b.weight)

  if (!parts.length) {
    return produced.length
      ? `Zrobione: ${count(produced.length, "czynność", "czynności", "czynności")}`
      : "Nic nie zostało zrobione"
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
  if (skipped > 1) t.push(count(skipped, "inną czynność", "inne czynności", "innych czynności"))

  const sentence = t.length === 1 ? t[0]! : `${t.slice(0, -1).join(", ")} i ${t[t.length - 1]}`
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}
