/**
 * STEROWANIE TURĄ — jedno miejsce, w którym „przerwij" naprawdę przerywa.
 *
 * DLACZEGO POWSTAŁ. Przycisk „przerwij" zapisywał `status='stopped'`, ale tura leciała
 * dalej: `runTurn` startuje w odczepionym `void (async () => …)()`, nie dostawał żadnego
 * sygnału i po zakończeniu nadpisywał stan na `done`. Zmierzone skutki były dwa i oba
 * gorsze od braku przycisku: sprawa wracała na „gotowe" chwilę po tym, jak człowiek ją
 * zatrzymał, a model dalej pracował i **dalej naliczał koszt** — czyli jedyna twarda
 * granica wydatków w tym produkcie dawała się obejść cierpliwością.
 *
 * Rejestr siedzi na `globalThis` z tego samego powodu, co memoizacja migracji: w trybie
 * deweloperskim Next przeładowuje moduły, a przerwanie musi trafić w turę uruchomioną
 * przed przeładowaniem.
 *
 * GRANICA, KTÓREJ TO NIE PRZEKRACZA: sygnał żyje w JEDNYM procesie. Przy wdrożeniu
 * na kilku procesach żądanie przerwania może trafić w inny proces niż tura i wtedy
 * przerwanie nie zadziała — zadziała natomiast strażnik `and status='working'` przy
 * zapisie stanu, więc sprawa NIE wróci na „gotowe". Biurko jedzie dziś jako jeden
 * kontener z jednym procesem; gdy to się zmieni, to miejsce wymaga kanału między
 * procesami, a nie mapy w pamięci.
 */

declare global {
  // eslint-disable-next-line no-var
  var __deskTurns: Map<string, AbortController> | undefined
}

const turns = (globalThis.__deskTurns ??= new Map<string, AbortController>())

/** Otwiera turę i oddaje sygnał, który trzeba podać modelowi. */
export function beginTurn(caseId: string): AbortSignal {
  turns.get(caseId)?.abort()
  const c = new AbortController()
  turns.set(caseId, c)
  return c.signal
}

/** Zamyka turę. Wołane w `finally`, więc także po awarii. */
export function endTurn(caseId: string): void {
  turns.delete(caseId)
}

/** Przerywa turę. `false`, gdy w tym procesie nie ma czego przerywać. */
export function stopTurn(caseId: string): boolean {
  const c = turns.get(caseId)
  if (!c) return false
  c.abort()
  turns.delete(caseId)
  return true
}

/**
 * Czy ten wyjątek to nasze przerwanie, a nie awaria.
 *
 * Rozróżnienie jest potrzebne, bo `readableFailure` napisałaby o przerwaniu jak
 * o błędzie dostawcy — a człowiek, który sam kliknął „przerwij", nie ma dostać
 * komunikatu o awarii.
 */
export function wasAborted(e: unknown): boolean {
  const name = (e as { name?: unknown })?.name
  if (name === "AbortError" || name === "TimeoutError") return true
  const message = String((e as { message?: unknown })?.message ?? e)
  return /abort/i.test(message)
}
