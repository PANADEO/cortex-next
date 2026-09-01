import type { DeskT } from "@cortex/desk-ui/i18n/locale"

/**
 * SŁOWA KATALOGU ZDOLNOŚCI — nazwa, opis i dział — stoją w słowniku, a nie w zasiewie.
 * W zasiewie zostaje tożsamość (`files.read`) i dział-właściciel jako WARTOŚĆ
 * (`accounting`), bo to jedno i drugie jest daną, a nie zdaniem do czytania.
 *
 * DLACZEGO PRZEZ TĘ FUNKCJĘ, a nie wprost `translate("capability." + id + ".name")`.
 * W bazie leżą zdarzenia zapisane ZANIM katalog przestał nosić słowa: `blocked` niesie
 * w nich polską nazwę i polski dział („Finanse"), a nie identyfikator. Klucz zbudowany
 * z takiej wartości w słowniku nie istnieje, a `makeDeskT` oddaje wtedy sam klucz —
 * na ekranie stanęłoby `capability.department.Finanse`. Brak klucza jest więc tutaj
 * pytaniem „czy to jeszcze stary zapis", a nie awarią.
 */
const translated = (translate: DeskT, key: string): string | null => {
  const text = translate(key)
  return text === key ? null : text
}

/** Nazwa zdolności. `fallback` to nazwa zapisana w starym zdarzeniu, jeśli jakaś była. */
export function capabilityLabel(translate: DeskT, id?: string, fallback = ""): string {
  if (!id) return fallback
  return translated(translate, `capability.${id}.name`) ?? fallback ?? id
}

export function capabilityDescription(translate: DeskT, id: string): string {
  return translated(translate, `capability.${id}.description`) ?? ""
}

/** Nazwa działu. Stary zapis niesie tu polski napis — wtedy zostaje, jak stoi. */
export function departmentLabel(translate: DeskT, department?: string): string {
  if (!department) return ""
  return translated(translate, `capability.department.${department}`) ?? department
}
