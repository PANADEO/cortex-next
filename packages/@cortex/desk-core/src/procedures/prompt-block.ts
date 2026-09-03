// CO Z PROCEDUR WCHODZI DO PROMPTU — i ile to kosztuje w każdej turze.
//
// Trzy tryby (ADR-0001 §4) różnią się WYŁĄCZNIE tym, kiedy płacimy:
//
//   always  treść w prompcie KAŻDEJ tury            koszt stały, płacony zawsze
//   index   nazwa i jedno zdanie; treść na żądanie   koszt ~1 wiersz, reszta gdy trzeba
//   paths   nic w prompcie; wskazówka przy dotknięciu pasującej ścieżki   koszt zero
//
// Tryb `paths` NIE MA tu nic do roboty i to jest sedno wzorca przejętego z OpenHands:
// procedura przypięta do katalogu nie kosztuje ani znaku, dopóki ktoś do tego katalogu
// nie sięgnie. Obsługuje ją `hint.ts`.

import type { StoredProcedure } from "./store"

export type PromptBlock = {
  /** Gotowy fragment do doklejenia do promptu systemowego. Pusty, gdy nie ma czego. */
  text: string
  /** Ile znaków kosztują procedury `always`. Do licznika na ekranie przełożonego. */
  alwaysChars: number
  /** Ile procedur stoi w indeksie. */
  indexed: number
}

/**
 * Indeks NIE JEST listą wszystkiego. Procedura `always` ma już swoją treść wyżej, więc
 * jej wiersz w indeksie byłby zaproszeniem do otwarcia rzeczy, którą model właśnie czyta —
 * czyli tury zmarnowanej na czynność bez skutku.
 */
export function promptBlock(visible: StoredProcedure[]): PromptBlock {
  const always = visible.filter((p) => p.loading === "always")
  const indexed = visible.filter((p) => p.loading === "index")

  const parts: string[] = []
  let alwaysChars = 0

  for (const p of always) {
    // Nagłówek z tytułem, żeby model mógł powiedzieć CZŁOWIEKOWI, na co się powołuje.
    const block = `JAK PRACUJEMY U NAS — ${p.title}\n${p.current.body}`
    alwaysChars += block.length
    parts.push(block)
  }

  if (indexed.length > 0) {
    parts.push(
      [
        "PROCEDURY FIRMY — spisane zasady tego, jak się tu robi konkretne rzeczy.",
        "Zanim wykonasz zadanie, do którego pasuje któraś z nich, OTWÓRZ JĄ czynnością",
        "open_procedure i pracuj według niej. Nie zgaduj treści z tytułu.",
        ...indexed.map((p) => `- ${p.name} — «${p.title}»: ${p.description}`),
      ].join("\n"),
    )
  }

  return { text: parts.join("\n\n"), alwaysChars, indexed: indexed.length }
}
