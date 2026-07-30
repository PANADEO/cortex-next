// Filtry kaskadowe tabeli szczegółowej — czyste funkcje, żeby dało się je
// przetestować bez renderowania Reacta.
//
// "Kaskadowe" znaczy: lista modeli zawęża się do wybranego zakresu i odwrotnie.
// Bez tego użytkownik może wybrać parę (model, zakres), która nie występuje
// razem w danych, i zobaczyć pustą tabelę bez wyjaśnienia — dokładnie to
// zachowanie miał oryginał i warto je zachować.

import type { UsageDetailRow } from "./types"

export const ALL_OPTION = "__all__"

export interface DetailFilters {
  model: string
  scope: string
}

export const NO_FILTERS: DetailFilters = { model: ALL_OPTION, scope: ALL_OPTION }

function matches(value: string, selected: string): boolean {
  return selected === ALL_OPTION || value === selected
}

/** Modele dostępne przy AKTUALNIE wybranym zakresie (nie przy wybranym modelu —
 *  inaczej lista zwinęłaby się do jednej pozycji po pierwszym wyborze). */
export function availableModels(rows: readonly UsageDetailRow[], scope: string): string[] {
  const models = new Set<string>()
  for (const row of rows) {
    if (matches(row.scope, scope)) models.add(row.model)
  }
  return [...models].sort((a, b) => a.localeCompare(b, "pl"))
}

export function availableScopes(rows: readonly UsageDetailRow[], model: string): string[] {
  const scopes = new Set<string>()
  for (const row of rows) {
    if (matches(row.model, model)) scopes.add(row.scope)
  }
  return [...scopes].sort((a, b) => a.localeCompare(b, "pl"))
}

export function filterRows(
  rows: readonly UsageDetailRow[],
  filters: DetailFilters,
): UsageDetailRow[] {
  return rows.filter((row) => matches(row.model, filters.model) && matches(row.scope, filters.scope))
}

/**
 * Po zmianie jednego wymiaru drugi bywa nieosiągalny — np. dotychczasowy model
 * nie występuje w nowo wybranym zakresie. Zamiast pokazywać pustą tabelę bez
 * wyjaśnienia, zwalniamy OSIEROCONY filtr.
 *
 * `changed` jest wymagany i nie da się go wywnioskować z samych wartości:
 * przy niepasującej parze oba wymiary wyglądają na "winne". Wymiar, który
 * użytkownik właśnie kliknął, ma zostać — zwalniamy ten drugi. Bez tego
 * argumentu funkcja kasowała oba naraz i wybór natychmiast znikał.
 */
export function reconcileFilters(
  rows: readonly UsageDetailRow[],
  filters: DetailFilters,
  changed: keyof DetailFilters,
): DetailFilters {
  const next = { ...filters }

  // Wartość, która w ogóle nie występuje w danych (np. po zmianie zakresu dat),
  // jest nieważna niezależnie od drugiego wymiaru.
  if (next.model !== ALL_OPTION && !availableModels(rows, ALL_OPTION).includes(next.model)) {
    next.model = ALL_OPTION
  }
  if (next.scope !== ALL_OPTION && !availableScopes(rows, ALL_OPTION).includes(next.scope)) {
    next.scope = ALL_OPTION
  }

  if (filterRows(rows, next).length > 0) return next

  next[changed === "model" ? "scope" : "model"] = ALL_OPTION
  return next
}
