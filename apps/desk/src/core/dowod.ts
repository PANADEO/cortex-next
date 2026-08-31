import type { DeskEvent } from './typy'
import { paruj } from './kroki'

export type Dowod = { weszlo: string[]; zrobione: string[]; nieSprawdzone: string[]; niewolno: string[] }

/**
 * Dowód powstaje WYŁĄCZNIE ze zdarzeń narzędzi. Nigdy z tekstu modelu.
 * Krok bez odpowiadającego mu `narzedzie_koniec` się nie liczy.
 */
export function dowodZeZdarzen(zdarzenia: DeskEvent[]): Dowod {
  const weszlo: string[] = []
  const zrobione: string[] = []
  const nieSprawdzone: string[] = []
  // czwarta lista: rzeczy, których agent nie zrobił nie dlatego, że nie umiał,
  // tylko dlatego, że ta osoba nie ma na nie zgody
  const niewolno = zdarzenia
    .filter((e): e is Extract<DeskEvent, { typ: 'zablokowane' }> => e.typ === 'zablokowane')
    .map((e) => (e.nazwa ? `${e.opis} — wymaga zdolności „${e.nazwa}" (dział ${e.dzial})` : e.opis))

  const przeczytane = new Set<string>()
  const zapisane = new Set<string>()
  const sprawdzone = new Set<string>()

  for (const k of paruj(zdarzenia)) {
    if (k.stan !== 'ok') continue
    const arg = k.argumenty as Record<string, string>

    if (k.nazwa === 'czytaj_plik' && arg.sciezka) {
      przeczytane.add(arg.sciezka)
      weszlo.push(`${arg.sciezka} — ${k.podsumowanie}`)
    }
    if (k.nazwa === 'zapisz_dokument' && arg.nazwa) {
      zapisane.add(arg.nazwa)
      zrobione.push(`zapisano ${arg.nazwa} — ${k.podsumowanie}`)
    }
    if (k.nazwa === 'sprawdz_dokument' && arg.nazwa) {
      sprawdzone.add(arg.nazwa)
      zrobione.push(`odczytano ${arg.nazwa} po zapisie — ${k.podsumowanie}`)
    }
    if (k.nazwa === 'zapisz_arkusz' && arg.nazwa) {
      zapisane.add(arg.nazwa)
      zrobione.push(`zapisano arkusz ${arg.nazwa} — ${k.podsumowanie}`)
    }
    if (k.nazwa === 'uruchom_obliczenia') zrobione.push(`policzono — ${k.podsumowanie}`)
    if (k.nazwa === 'generuj_obraz' && arg.nazwa) zrobione.push(`wygenerowano ${arg.nazwa}`)
    if (k.nazwa === 'zapisz_do_moich_plikow' && k.podsumowanie) {
      zrobione.push(`odłożono do Moich plików: ${k.podsumowanie}`)
    }
  }

  // Reguła: zapisany dokument, którego nikt nie odczytał po zapisie, jest NIESPRAWDZONY.
  for (const n of zapisane) {
    if (!sprawdzone.has(n)) nieSprawdzone.push(`zawartość pliku ${n} po zapisie`)
  }
  if (zapisane.size > 0 && przeczytane.size === 0) {
    nieSprawdzone.push('dokument powstał bez odczytania choćby jednego pliku z biurka')
  }
  return { weszlo, zrobione, nieSprawdzone, niewolno }
}
