import type { DeskEvent, PlikMeta } from './typy'

/**
 * Pochodzenie pliku w teczce sprawy wyliczamy ze zdarzeń, nie z układu katalogów.
 *
 * Dwa źródła, bo załącznik istnieje na dysku ZANIM powstanie polecenie:
 * `zalacznik` zapisuje wgranie w chwili, gdy plik ląduje w teczce, a `mysl.zalaczniki`
 * mówi, co ostatecznie poszło z poleceniem. Bez pierwszego z nich plik wgrany
 * i jeszcze niewysłany przez półtorej sekundy udaje wynik pracy agenta —
 * i tak właśnie trafiał do panelu wyniku, obok dokumentów, których nikt nie tworzył.
 *
 * Ten moduł musi zostać CZYSTY — sięga po niego komponent kliencki, więc żaden import
 * `pg` ani `node:fs` nie może tu trafić. Część serwerowa siedzi w `teczka-serwer.ts`.
 */
export function podzielTeczke(pliki: PlikMeta[], zdarzenia: DeskEvent[], wgrywane: string[] = []) {
  const odCzlowieka = new Set<string>(wgrywane)
  for (const e of zdarzenia) {
    if (e.typ === 'mysl') for (const n of e.zalaczniki ?? []) odCzlowieka.add(n)
    if (e.typ === 'zalacznik') for (const n of e.nazwy) odCzlowieka.add(n)
  }
  const dokumenty = pliki.filter((p) => !p.katalog)
  return {
    wyniki: dokumenty.filter((p) => !odCzlowieka.has(p.nazwa)),
    zalaczniki: dokumenty.filter((p) => odCzlowieka.has(p.nazwa)),
  }
}
