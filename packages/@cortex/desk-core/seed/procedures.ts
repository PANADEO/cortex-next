// PROCEDURY DOSTARCZANE Z WDROŻENIEM — treść w formacie `SKILL.md`, dosłownie.
//
// ODEJŚCIE OD LITERY ADR-0001 §3, świadome i z powodem. ADR mówi o katalogu
// `seed/procedures/**/SKILL.md` czytanym z dysku. Tak nie może być: `readdir` po ścieżce
// zbudowanej z `__dirname` jest NIEWIDOCZNY dla śledzenia zależności Nexta, więc katalog
// nie trafiłby do obrazu produkcyjnego. Objawem nie byłby błąd, tylko wdrożenie BEZ
// procedur — czyli dokładnie ta cicha nieobecność, przez którą w tym repozytorium istnieje
// `tile-manifests-completeness.test.ts`.
//
// Zmienia się WYŁĄCZNIE nośnik. Format zostaje ten sam co przy wgraniu przez przełożonego
// i idzie przez ten sam `parseSkill` — drugiej drogi wejścia procedury do produktu nie ma.
//
// Te trzy procedury pokazują wszystkie trzy tryby i są SZKICEM DLA KLIENTA, nie prawdą
// o jego firmie: pierwszą rzeczą, którą przełożony zrobi, ma być wydanie ich na nowo
// własnymi słowami.

export const SEED_PROCEDURES: string[] = [
  // ── always ───────────────────────────────────────────────────────────────────────
  // Kawałek, który do 03.09.2026 był wklejony w `SYSTEM` w `runtime.ts` — ten sam
  // u każdego klienta i niezmienialny bez wdrożenia. Doktryna produktu (jak rozmawiasz,
  // czego nie robisz nigdy, reguła dowodu) ZOSTAJE w kodzie; tu schodzi to, co jest
  // umową konkretnej firmy.
  `---
name: zasady-firmy
title: Zasady naszej firmy
description: Jak zapisujemy kwoty i daty i jak podpisujemy dokumenty.
loading: always
---

- Kwoty zapisujemy po polsku: przecinek dziesiętny i spacja co tysiąc — 8 500,00 zł.
  Nigdy 8500.00 ani 8,500.00.
- Daty zapisujemy jako 31.08.2026. W nazwach plików odwrotnie: 2026-08-31, żeby
  układały się chronologicznie.
- Miesiąc rozliczeniowy nazywamy po polsku: „sierpień 2026", nie „08/2026".
- Każde zestawienie kończymy wierszem „Razem" z sumą.
- Nie podajemy w dokumentach nazwisk osób z firm zewnętrznych — wystarczy nazwa firmy.`,

  // ── index (domyślny) ─────────────────────────────────────────────────────────────
  `---
name: zestawienie-vat
title: Zestawienie VAT
description: Jak składamy miesięczne zestawienie VAT z faktur zakupowych i sprzedażowych.
scope: [accounting, finance]
---

1. Bierzemy WSZYSTKIE faktury z danego miesiąca — także te wystawione ostatniego dnia.
2. Rozdzielamy na zakupowe i sprzedażowe. Faktura korygująca idzie tam, gdzie pierwotna.
3. Sumujemy osobno w każdej stawce: 23%, 8%, 5%, 0% i zwolnione.
4. Kwoty netto i VAT liczymy z pozycji faktury, nie z podsumowania — podsumowania bywają
   zaokrąglone przez wystawcę.
5. Jeżeli faktura nie ma numeru NIP kontrahenta, NIE zgadujemy go. Wypisujemy taką fakturę
   osobno pod zestawieniem, z adnotacją „brak NIP".
6. Wynik zapisujemy jako arkusz; dokument opisowy tylko wtedy, gdy ktoś o niego poprosi.`,

  // ── paths ────────────────────────────────────────────────────────────────────────
  `---
name: faktury-zakupowe
title: Faktury zakupowe
description: Co sprawdzamy w fakturze zakupowej, zanim wejdzie do rozliczenia.
loading: paths
paths: ["Moje pliki/Faktury", "Wspólne pliki/Faktury"]
scope: [accounting]
---

Zanim policzysz cokolwiek z faktury zakupowej, sprawdź cztery rzeczy:

1. Czy jest data sprzedaży ORAZ data wystawienia. Do rozliczenia bierzemy datę sprzedaży.
2. Czy numer NIP sprzedawcy jest kompletny (10 cyfr).
3. Czy suma pozycji zgadza się z kwotą do zapłaty. Rozbieżność wypisz, nie poprawiaj.
4. Czy to nie jest duplikat — ten sam numer i ten sam sprzedawca już w tym miesiącu.

Czego brakuje, wypisz w odpowiedzi. Niczego nie dopisuj do faktury samodzielnie.`,
]
