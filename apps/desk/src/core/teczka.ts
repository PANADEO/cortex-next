import type { DeskEvent, PlikMeta } from './typy'

/**
 * Pochodzenie pliku w teczce sprawy wyliczamy ze zdarzeń, nie z układu katalogów:
 * nazwy załączników człowieka siedzą w zdarzeniu `mysl`. Dzięki temu nic nie trzeba
 * przenosić na dysku, a rozdział działa też dla spraw sprzed tej zmiany.
 *
 * Ten moduł musi zostać CZYSTY — sięga po niego komponent kliencki, więc żaden import
 * `pg` ani `node:fs` nie może tu trafić. Część serwerowa siedzi w `teczka-serwer.ts`.
 */
export function podzielTeczke(pliki: PlikMeta[], zdarzenia: DeskEvent[]) {
  const odCzlowieka = new Set<string>()
  for (const e of zdarzenia) {
    if (e.typ === 'mysl') for (const n of e.zalaczniki ?? []) odCzlowieka.add(n)
  }
  const dokumenty = pliki.filter((p) => !p.katalog)
  return {
    wyniki: dokumenty.filter((p) => !odCzlowieka.has(p.nazwa)),
    zalaczniki: dokumenty.filter((p) => odCzlowieka.has(p.nazwa)),
  }
}
