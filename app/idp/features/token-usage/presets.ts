// Presety zakresu dat — czyste funkcje z jawnym "dziś" w argumencie, żeby
// dały się przetestować bez zamrażania zegara.
//
// STREFA CZASOWA: "dziś" bierzemy z przeglądarki użytkownika i wysyłamy jako
// gołe YYYY-MM-DD. Proxy parsuje tę datę we WŁASNEJ strefie (TIMEZONE,
// domyślnie Europe/Warsaw). Żadnej konwersji po drodze — dokładnie tak działa
// dzisiejszy Streamlit i tylko tak oba widoki pokazują to samo.

import { format, startOfMonth, subDays } from "date-fns"
import type { UsageDateRange } from "./types"

export type PresetId = "current-month" | "last-7-days" | "last-30-days"

export interface Preset {
  id: PresetId
  /** Napis bierze się z `filter.presets.<id>` w przestrzeni `token-usage` —
   *  preset niesie wyłącznie tożsamość i regułę liczenia zakresu. */
  build: (today: Date) => UsageDateRange
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export const PRESETS: readonly Preset[] = [
  {
    id: "current-month",
    build: (today) => ({ start: toIsoDate(startOfMonth(today)), end: toIsoDate(today) }),
  },
  {
    // 7 dni licząc z dzisiejszym — zakres jest obustronnie domknięty po stronie
    // proxy, więc odejmujemy 6, nie 7.
    id: "last-7-days",
    build: (today) => ({ start: toIsoDate(subDays(today, 6)), end: toIsoDate(today) }),
  },
  {
    id: "last-30-days",
    build: (today) => ({ start: toIsoDate(subDays(today, 29)), end: toIsoDate(today) }),
  },
]

/** Domyślny widok po wejściu na ekran: pierwszy dzień bieżącego miesiąca do
 *  dziś — parytet z oryginałem. */
export function defaultRange(today: Date = new Date()): UsageDateRange {
  return PRESETS[0]!.build(today)
}
