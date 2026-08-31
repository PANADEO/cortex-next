import { katalogZdolnosci } from './brama-zdolnosci'
import { UZYTKOWNICY } from './tozsamosc'

type Wpis = { at: string; kto: string; typ: string; szczegoly: Record<string, unknown> }

const nazwaZdolnosci = (id: unknown) =>
  katalogZdolnosci.find((z) => z.id === id)?.nazwa ?? String(id ?? '')

/** W dzienniku dla audytora mają stać imiona, nie identyfikatory z bazy. */
const imie = (id: unknown) => {
  const u = UZYTKOWNICY.find((x) => x.id === id)
  return u ? `${u.imie} ${u.nazwisko}` : String(id ?? '')
}

/**
 * Dziennik czyta audytor, nie programista — więc surowy JSON nigdy nie trafia na ekran.
 * Nieznany typ opisujemy uczciwie jako nieznany, zamiast udawać, że rozumiemy.
 */
export function opiszWpis(w: Wpis): { tekst: string; waga: 'zwykly' | 'wazny' } {
  const s = w.szczegoly ?? {}
  switch (w.typ) {
    case 'tura.start':
      return { tekst: `zleciła pracę · zakres uprawnień ${s.odcisk ?? '?'} (${Array.isArray(s.zdolnosci) ? s.zdolnosci.length : '?'} zdolności)`, waga: 'zwykly' }
    case 'tura.koniec':
      return { tekst: 'praca zakończona', waga: 'zwykly' }
    case 'tura.blad':
      return { tekst: `praca nie powiodła się: ${s.powod ?? 'bez powodu'}`, waga: 'wazny' }
    case 'prosba.o.dostep':
      return { tekst: `poprosiła o zdolność „${nazwaZdolnosci(s.zdolnosc)}"`, waga: 'wazny' }
    case 'prosba.przyznana':
      return { tekst: `przyznał zdolność „${nazwaZdolnosci(s.zdolnosc)}" osobie ${imie(s.komu)}`, waga: 'wazny' }
    case 'prosba.odrzucona':
      return { tekst: `odmówił zdolności „${nazwaZdolnosci(s.zdolnosc)}" osobie ${imie(s.komu)}`, waga: 'wazny' }
    case 'zdolnosc.cofnieta':
      return { tekst: `cofnął zdolność „${nazwaZdolnosci(s.zdolnosc)}" osobie ${imie(s.komu)}`, waga: 'wazny' }
    case 'zdolnosc.brak':
      return { tekst: `napotkała brak zdolności: ${s.opis ?? ''}`, waga: 'wazny' }
    case 'dostep.odrzucony':
      return { tekst: 'próba sięgnięcia po cudze — odrzucona', waga: 'wazny' }
    case 'pliki.wgranie':
      return { tekst: `wgrała plik ${s.nazwa ?? ''}`, waga: 'zwykly' }
    case 'pliki.kosz':
      return { tekst: `usunęła plik ${s.sciezka ?? ''}`, waga: 'zwykly' }
    case 'pliki.przywroc':
      return { tekst: 'przywróciła plik z kosza', waga: 'zwykly' }
    case 'pliki.przenies':
      return { tekst: `przeniosła plik ${s.z ?? ''}`, waga: 'zwykly' }
    case 'pliki.kopiuj':
      return { tekst: `skopiowała plik ${s.z ?? ''}`, waga: 'zwykly' }
    case 'pliki.katalog':
      return { tekst: `utworzyła folder ${s.sciezka ?? ''}`, waga: 'zwykly' }
    default:
      return { tekst: `zdarzenie „${w.typ}" (nieopisane)`, waga: 'zwykly' }
  }
}
