import type { DeskEvent } from './typy'

export type Dowod = { weszlo: string[]; zrobione: string[]; nieSprawdzone: string[] }

/**
 * Dowód powstaje WYŁĄCZNIE ze zdarzeń narzędzi. Nigdy z tekstu modelu.
 * Wiersz dowodu bez odpowiadającego mu `narzedzie_koniec` się nie renderuje.
 */
export function dowodZeZdarzen(zdarzenia: DeskEvent[]): Dowod {
  const weszlo: string[] = []
  const zrobione: string[] = []
  const nieSprawdzone: string[] = []

  const przeczytane = new Set<string>()
  const zapisane = new Set<string>()
  const sprawdzone = new Set<string>()

  for (let i = 0; i < zdarzenia.length; i++) {
    const e = zdarzenia[i]
    if (e.typ !== 'narzedzie_start') continue
    const koniec = zdarzenia.slice(i + 1).find((x) => x.typ === 'narzedzie_koniec') as
      | Extract<DeskEvent, { typ: 'narzedzie_koniec' }>
      | undefined
    if (!koniec || !koniec.ok) continue
    const arg = e.argumenty as Record<string, string>

    if (e.nazwa === 'czytaj_plik' && arg.sciezka) {
      przeczytane.add(arg.sciezka)
      weszlo.push(`${arg.sciezka} — ${koniec.podsumowanie}`)
    }
    if (e.nazwa === 'zapisz_dokument' && arg.nazwa) {
      zapisane.add(arg.nazwa)
      zrobione.push(`zapisano ${arg.nazwa} — ${koniec.podsumowanie}`)
    }
    if (e.nazwa === 'sprawdz_dokument' && arg.nazwa) {
      sprawdzone.add(arg.nazwa)
      zrobione.push(`odczytano ${arg.nazwa} po zapisie — ${koniec.podsumowanie}`)
    }
    if (e.nazwa === 'uruchom_obliczenia') zrobione.push(`policzono — ${koniec.podsumowanie}`)
    if (e.nazwa === 'generuj_obraz' && arg.nazwa) zrobione.push(`wygenerowano ${arg.nazwa}`)
  }

  // Reguła: zapisany dokument, którego nikt nie odczytał po zapisie, jest NIESPRAWDZONY.
  for (const n of zapisane) {
    if (!sprawdzone.has(n)) nieSprawdzone.push(`zawartość pliku ${n} po zapisie`)
  }
  if (zapisane.size > 0 && przeczytane.size === 0) {
    nieSprawdzone.push('dokument powstał bez odczytania choćby jednego pliku z biurka')
  }
  return { weszlo, zrobione, nieSprawdzone }
}
