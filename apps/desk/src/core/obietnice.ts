import type { DeskEvent, PlikMeta } from './typy'
import { paruj } from './kroki'

const ROZSZERZENIA = 'md|csv|tsv|txt|json|xlsx|xls|pdf|docx|png|jpe?g|gif|webp|svg'
const NAZWA_PLIKU = new RegExp(String.raw`[\p{L}\p{N}_.()\-]+\.(?:${ROZSZERZENIA})\b`, 'giu')

/** Zdania, w których model przypisuje sobie wytworzenie pliku. */
const OBIETNICA = /zapis|utworz|stworz|wygenerow|przygotowa|powsta/i

/** Narzędzia, po których w teczce naprawdę przybywa plik. */
const WYTWARZAJACE = new Set([
  'zapisz_dokument', 'zapisz_arkusz', 'generuj_obraz', 'zapisz_do_moich_plikow',
])

/**
 * Reguła dowodu obowiązuje TAKŻE PRZECIW tekstowi modelu.
 *
 * Do tej pory dowód mówił wyłącznie o tym, co się wydarzyło; gdy nie wydarzyło się nic,
 * karty przebiegu po prostu nie było — a zdanie „Zapisano dokument malpy.md w teczce sprawy"
 * zostawało na ekranie samo, bez niczego, co by mu zaprzeczyło. Człowiek nie ma jak
 * odróżnić zdania prawdziwego od zmyślonego, więc musi to zrobić za niego aplikacja.
 *
 * Zgłaszamy nazwę pliku tylko wtedy, gdy spełnione są NARAZ trzy warunki: odpowiedź
 * przypisuje sobie wytworzenie pliku, nazwa nie pochodzi z żadnej udanej czynności w tej
 * turze i takiego pliku nie ma w teczce. Trzy warunki, bo cena fałszywego alarmu jest tu
 * wysoka — ostrzeżenie, które myli, przestaje być czytane.
 */
export function obietniceBezPokrycia(
  tekst: string,
  zdarzeniaTury: DeskEvent[],
  teczka: PlikMeta[],
): string[] {
  if (!OBIETNICA.test(tekst)) return []

  const pokryte = new Set<string>()
  for (const k of paruj(zdarzeniaTury)) {
    if (k.stan !== 'ok' || !WYTWARZAJACE.has(k.nazwa)) continue
    const n = (k.argumenty as Record<string, unknown>).nazwa
    if (typeof n === 'string') pokryte.add(n.toLowerCase())
  }
  for (const p of teczka) pokryte.add(p.nazwa.toLowerCase())

  const bez = new Set<string>()
  for (const trafienie of tekst.match(NAZWA_PLIKU) ?? []) {
    const nazwa = trafienie.replace(/[.,;:]+$/, '')
    if (!pokryte.has(nazwa.toLowerCase())) bez.add(nazwa)
  }
  return [...bez]
}

/**
 * Pliki, które w tej turze NAPRAWDĘ powstały — po nazwach z udanych czynności.
 * Rozmowa pokazuje je jako karty, więc lista musi pochodzić ze zdarzeń, nie z tekstu.
 */
export function wytworzone(zdarzeniaTury: DeskEvent[]): string[] {
  const nazwy: string[] = []
  for (const k of paruj(zdarzeniaTury)) {
    if (k.stan !== 'ok' || !WYTWARZAJACE.has(k.nazwa)) continue
    const n = (k.argumenty as Record<string, unknown>).nazwa
    if (typeof n === 'string' && !nazwy.includes(n)) nazwy.push(n)
  }
  return nazwy
}
