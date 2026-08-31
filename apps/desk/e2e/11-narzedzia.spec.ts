import { test, expect } from './osoby'
import { dowodZeZdarzen } from '../src/core/dowod'
import { paruj, opisKroku, podsumujGrupe } from '../src/core/kroki'
import { karta } from '../src/core/narzedzia'
import { wytworzone } from '../src/core/obietnice'
import type { DeskEvent } from '../src/core/typy'

/** Para start/koniec jednego narzędzia — tak, jak zapisuje ją runtime. */
const para = (id: string, nazwa: string, argumenty: Record<string, unknown>, podsumowanie: string, ok = true): DeskEvent[] => [
  { typ: 'narzedzie_start', id, nazwa, etykieta: `etykieta ${nazwa}`, argumenty },
  { typ: 'narzedzie_koniec', id, nazwa, ok, podsumowanie, ms: 5 },
]

test.describe('Obszar 19 · Opis i dowód pochodzą z kart, nie z listy nazw w kodzie', () => {
  test('Wbudowane czynności dają dokładnie te same zdania dowodu co przed zmianą', () => {
    const d = dowodZeZdarzen([
      ...para('a', 'lista_plikow', { katalog: 'Moje pliki' }, '3 pozycji'),
      ...para('b', 'czytaj_plik', { sciezka: 'Moje pliki/a.csv' }, '10 wierszy'),
      ...para('c', 'zapisz_dokument', { nazwa: 'w.md' }, '100 znaków'),
      ...para('d', 'sprawdz_dokument', { nazwa: 'w.md' }, '0 pustych pól'),
      ...para('e', 'zapisz_arkusz', { nazwa: 't.csv' }, '5 wierszy'),
      ...para('f', 'generuj_obraz', { nazwa: 'i.png', opis: 'kot' }, 'zapisano i.png'),
      ...para('g', 'uruchom_obliczenia', { opis: 'suma' }, 'policzone'),
      ...para('h', 'zapisz_do_moich_plikow', { nazwa: 'w.md', cel: 'Moje pliki/w.md' }, 'Moje pliki/w.md'),
    ])
    expect(d.weszlo).toEqual(['Moje pliki/a.csv — 10 wierszy'])
    expect(d.zrobione).toEqual([
      'zapisano w.md — 100 znaków',
      'odczytano w.md po zapisie — 0 pustych pól',
      'zapisano arkusz t.csv — 5 wierszy',
      'wygenerowano i.png',
      'policzono — policzone',
      'odłożono do Moich plików: Moje pliki/w.md',
    ])
    // przeglądanie teczki świadomie nie zostawia wiersza — nic nie wnosi i nic nie zmienia
    expect(d.weszlo.join(' ')).not.toMatch(/pozycji/)
  })

  test('Obraz nadal nie podlega regule sprawdzenia, arkusz nadal podlega', () => {
    const obraz = dowodZeZdarzen([
      ...para('a', 'czytaj_plik', { sciezka: 'x.csv' }, '1 wiersz'),
      ...para('b', 'generuj_obraz', { nazwa: 'i.png' }, 'zapisano i.png'),
    ])
    expect(obraz.nieSprawdzone).toHaveLength(0)

    const arkusz = dowodZeZdarzen([
      ...para('a', 'czytaj_plik', { sciezka: 'x.csv' }, '1 wiersz'),
      ...para('b', 'zapisz_arkusz', { nazwa: 't.csv' }, '5 wierszy'),
    ])
    expect(arkusz.nieSprawdzone).toContain('zawartość pliku t.csv po zapisie')
  })

  test('Zdanie podsumowania grupy brzmi tak samo jak przed zmianą', () => {
    const k = paruj([
      ...para('a', 'lista_plikow', {}, '3 pozycji'),
      ...para('b', 'czytaj_plik', { sciezka: 'a.csv' }, '10 wierszy'),
      ...para('c', 'zapisz_dokument', { nazwa: 'w.md' }, '100 znaków'),
      ...para('d', 'sprawdz_dokument', { nazwa: 'w.md' }, '0 pustych pól'),
    ])
    expect(podsumujGrupe(k)).toBe('Przejrzałem teczkę, przeczytałem 1 plik i zapisałem 1 dokument')
  })

  test('Dokument i arkusz sumują się w jeden człon, bo dla człowieka to ta sama rzecz', () => {
    const k = paruj([
      ...para('a', 'zapisz_dokument', { nazwa: 'w.md' }, '100 znaków'),
      ...para('b', 'zapisz_arkusz', { nazwa: 't.csv' }, '5 wierszy'),
    ])
    expect(podsumujGrupe(k)).toBe('Zapisałem 2 dokumenty')
  })
})

test.describe('Obszar 20 · Narzędzie, którego nikt nie zna, nie znika po cichu', () => {
  const obce = para('x', 'mcp_nbp_kurs_waluty', { data: '2026-08-31' }, 'EUR 4,2841')

  test('Nieznane narzędzie zostawia wiersz dowodu — inaczej sprawa udaje, że nic się nie stało', () => {
    const d = dowodZeZdarzen(obce)
    expect(d.weszlo.length + d.zrobione.length).toBeGreaterThan(0)
  })

  test('Wiersz idzie do „Co weszło" i nazywa serwer, z którego pochodzi', () => {
    const d = dowodZeZdarzen(obce)
    expect(d.weszlo).toHaveLength(1)
    expect(d.weszlo[0]).toContain('nbp')
    expect(d.weszlo[0]).toContain('EUR 4,2841')
    // „odpowiedział 200" to nie to samo co „rzecz się wydarzyła" — do zrobionych nie wchodzi
    expect(d.zrobione).toHaveLength(0)
  })

  test('Przebieg mówi o nim po polsku, nie surowym kluczem narzędzia', () => {
    const [krok] = paruj(obce)
    const o = opisKroku(krok)
    expect(o.tytul).toBe('Odpytałem nbp')
    expect(o.tytul).not.toContain('mcp_')
  })

  test('Nieznane narzędzie wchodzi do zdania podsumowania', () => {
    expect(podsumujGrupe(paruj(obce))).toBe('Odpytałem nbp 1 raz')
  })

  test('Nieznana czynność nie udaje, że wytworzyła plik', () => {
    expect(wytworzone(obce)).toHaveLength(0)
    expect(karta('mcp_nbp_kurs_waluty').klasa).toBe('zewnetrzna')
  })

  test('Narzędzie bez rozpoznawalnego serwera też dostaje kartę, a nie wyjątek', () => {
    const k = karta('cos_zupelnie_innego')
    expect(k.klasa).toBe('zewnetrzna')
    expect(k.ok).toContain('spoza katalogu')
  })
})
