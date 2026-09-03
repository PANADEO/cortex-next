// KTO WIDZI KTÓRĄ PROCEDURĘ — filtr NA ODKRYCIU, nie odmowa po fakcie.
//
// Ten sam wzorzec, co przy zdolnościach w `runtime.ts`: czynność bez zdolności nie jest
// rejestrowana, więc model nie może dostać odmowy na coś, czego nie widzi. Tutaj tak samo —
// procedura spoza zasięgu osoby nie wchodzi do indeksu w prompcie, więc nie ma jak zostać
// otwarta „przez pomyłkę".
//
// DRUGIE SPRAWDZENIE i tak jest, w `open_procedure`, i to nie jest nadmiarowość: model
// dostaje nazwę procedury jako NAPIS, a napis da się zgadnąć albo przenieść ze starej
// sprawy. Odmowa jest wtedy ZDARZENIEM, czyli zostawia ślad — cisza by go nie zostawiła.

import type { StoredProcedure } from "./store"

/**
 * Czy ta osoba ma tę procedurę w swojej pracy.
 *
 * PUSTY ZASIĘG = WSZYSCY. To jest domyślne i tak ma być: „zasady firmy" dotyczą firmy,
 * a wymuszanie wypisania wszystkich działów przy każdej takiej procedurze kończyłoby się
 * listą, która rozjeżdża się przy pierwszym nowym dziale.
 *
 * PRZEŁOŻONY NIE MA OBEJŚCIA — i to jest decyzja, nie przeoczenie. Na ekranie nadzoru widzi
 * wszystko, bo tam pyta „co w firmie istnieje". W TURZE pyta o co innego: „według czego mam
 * pracować JA". Procedura księgowości w turze osoby z zarządu nie jest przywilejem, tylko
 * kosztem w prompcie i szansą, że model zastosuje cudzą regułę do nie swojej sprawy.
 */
export function appliesTo(p: StoredProcedure, department: string): boolean {
  if (p.status !== "active") return false
  if (p.scope.length === 0) return true
  return p.scope.includes(department)
}

/** Procedury, które wchodzą do tury tej osoby. */
export function visibleFor(all: StoredProcedure[], department: string): StoredProcedure[] {
  return all.filter((p) => appliesTo(p, department))
}
