---
name: code-ui
description: Konwencje UI w cortex-frontend — tylko @cortex/ui + @cortex/styles, zero customowego CSS/inline hex/emoji. Użyj przy pisaniu dowolnego komponentu React/JSX.
---

# code-ui

## Reguły (twarde, bez wyjątków)

1. Komponenty wyłącznie z `@cortex/ui` (shadcn/ui + Radix). Nowy prymityw UI → dodaj do `@cortex/ui`, nie twórz lokalnego odpowiednika w module.
2. Kolory/spacing wyłącznie przez tokeny `@cortex/styles` (CSS variables) — zero inline hex (`#4A90E2` itd.), zero magicznych wartości Tailwind poza tokenami.
3. Zero emoji w UI copy, komentarzach, komunikatach błędów — produkt dla regulowanych klientów enterprise, ma wyglądać intencjonalnie.
4. UI copy po polsku, identyfikatory kodu po angielsku (zmienne, funkcje, nazwy plików). To obejmuje wprost **segmenty ścieżek URL** (foldery Next.js file-based routing — folder = URL) — zawsze angielskie, bez wyjątków typu "spójność z istniejącym polskim segmentem w tym samym module". Poprawka realnego błędu z 02.08.2026: `/system-config/{aplikacje,uzytkownicy}` i `/ilustromat/{generowanie,szablony}` (razem z komponentami `AplikacjePage`/`UzytkownicyPage`/`SzablonyPage`/`GenerowaniePage` i hookami-hybrydami `useKonfiguracjaApplications` itp.) zostały zbudowane po polsku — dla `system-config` była to jawna, ale błędna decyzja ([[cortex-frontend-aplikacje-ux-projekt]]: "Polski segment, spójnie z istniejącym `/system-config/uzytkownicy`"), tu odwrócona. Naprawione na `/system-config/{applications,users}` i `/ilustromat/{generation,templates}` — stare adresy żyją dalej jako 308 w `LEGACY_REDIRECTS` (`app/idp/middleware.ts`).
5. Logo (`app/idp/public/cortex-logo.png`) i kolor marki `cortex` (`#4A90E2` w `tailwind.config.ts`) — nie wymyślać alternatyw.

## Nagłówki stron

`st.subheader`-style hierarchia nieaktualna tu (to reguła ze świata Streamlit) — w Next.js: jeden spójny wzorzec nagłówka strony na kafelek, patrz istniejące `*Form` w `ai-tool-workspace.tsx` jako referencja układu (label + opis + pola + wynik).

## Dark mode

Jeden asset, jeden mechanizm: `<Image className="dark:invert dark:hue-rotate-180" />` dla logo. Nie dodawać osobnych assetów per motyw bez wyraźnej potrzeby.

## Listy: row-actions, nie klik-w-wiersz

Wiersz tabeli/listy **nigdy nie jest sam w sobie interaktywny** — bez `onClick`/`tabIndex`/`role="link"`/ręcznego `onKeyDown` na `<tr>`. Nawigacja i akcje idą wyłącznie przez dedykowany element w ostatniej kolumnie (nagłówek pusty: `<th className="px-4 py-2" />`), wyrównanej do prawej krawędzi (`text-right`). Klik w resztę wiersza nic nie robi — to nie jest zaniedbanie, to świadomy brak funkcji tam, gdzie nie ma jej po co budować.

**Zero widocznego tekstu na samym wierszu — zawsze `Button size="icon" variant="ghost"`, ta sama ikona 4×4, ten sam wariant, niezależnie od tego która z gałęzi niżej się stosuje.** Tekst opisujący akcję żyje wyłącznie w `title`/`aria-label` (tooltip + czytnik ekranu) albo wewnątrz otwartego `DropdownMenuItem` — nigdy jako widoczna etykieta przy przycisku w wierszu. Złamanie tej reguły (np. `Button size="sm" variant="outline"` z tekstem obok ikon-only przycisków w innych kolumnach/ekranach) jest dokładnie tym, co robi listę niespójną między ekranami tego samego modułu — to był realny bug (kolumna akcji w `users/page.tsx` miała widoczny tekst "Zmień role" obok przycisków bez tekstu w `role.tsx`/`applications/page.tsx`), nie hipotetyczne ryzyko.

Dobór WIDGETU (nie treści etykiety — ta zawsze jest ukryta) zależy od liczby akcji i ich dostępności:

- **Jedna akcja** (np. "przejdź do szczegółów") → jeden `Button size="icon" variant="ghost"` z pasującą ikoną (`ChevronRight` dla nawigacji drill-down, konkretna ikona czynności dla akcji bezpośredniej).
- **Dwie akcje, z których jedna bywa zablokowana z wyjaśnieniem** (np. Edytuj zawsze dostępne, Usuń zablokowane dla wiersza chronionego) → dwa osobne przyciski-ikony obok siebie. Stan zablokowany (`disabled` + `title`/tooltip tłumaczący dlaczego) ma być widoczny wprost, nie schowany w menu — użytkownik ma wiedzieć, że coś jest niemożliwe, zanim kliknie, nie dopiero po otwarciu menu.
- **Dwie akcje o równej dostępności, albo trzy i więcej** → jeden przycisk-trigger (`Button size="icon" variant="ghost"` z `MoreHorizontal`) otwierający `DropdownMenu` (`@cortex/ui`) — treść etykiet idzie do środka, do `DropdownMenuItem`.
- **Jedna akcja wyraźnie najczęstsza + reszta rzadsza** (np. lista użytkowników: "zmień role" dzieje się częściej niż "edytuj dane"/"dezaktywuj") → wyróżniona akcja zostaje osobnym `Button size="icon" variant="ghost"` (wciąż bez tekstu — sama ikona + `title`/`aria-label`), reszta trafia do sąsiadującego triggera `MoreHorizontal`. Nie dodawaj trzeciego wariantu wizualnego (obramowanie, tło, tekst) żeby "podkreślić" że to główna akcja — sama pozycja (pierwsza od lewej w grupie akcji) i dobór ikony wystarczą.

Przykład (dwie akcje, jedna zablokowana):

```tsx
<td className="px-4 py-2 text-right">
  <div className="flex justify-end gap-1">
    <Button size="icon" variant="ghost" onClick={() => onEdit(row)} aria-label={`Edytuj ${row.name}`}>
      <Pencil className="h-4 w-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      disabled={row.isProtected}
      title={row.isProtected ? "Wiersz chroniony — nie można usunąć" : undefined}
      onClick={() => onDelete(row)}
      aria-label={`Usuń ${row.name}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
</td>
```

Efekt uboczny wart odnotowania: prawdziwy `<button>`/`Link` dostaje obsługę klawiatury (`Tab`, `Enter`, focus-visible) za darmo z przeglądarki i Radixa — nie trzeba (i nie wolno) odtwarzać jej ręcznym `onKeyDown` na `<tr>`.

## Breadcrumb

Etykieta i linki breadcrumbu dla każdego kafelka muszą pochodzić z tego samego rejestru co
sidebar (`TILES` w `lib/tiles.ts` dla etykiety root, `*_NAV` w `lib/nav.ts` dla etykiet
segmentów środkowych), nie z osobnej ręcznie utrzymywanej listy kafelków w `lib/breadcrumbs.ts`.
`breadcrumbs.ts`'s `labelForSegment()`/`navLabelsForSegment()` czytają te dwa rejestry
bezpośrednio — nowy kafelek dopisany do `TILES` (i, jeśli ma własną nawigację, do `nav.ts`
przez wpis w `NAV_SECTIONS_BY_SEGMENT`) dostaje poprawny breadcrumb automatycznie, bez
trzeciego miejsca do aktualizacji. Dodanie nowego kafelka bez wpisu w `nav.ts` nadal daje
DZIAŁający link (bo href segmentu to zawsze surowy `/${segment}` z URL, nigdy stała `/idp`)
— tylko z mniej ładną etykietą segmentu (raw URL segment zamiast tłumaczonej nazwy). (Osobna,
mała mapa `EXTRA_ROUTE_LABELS_BY_SEGMENT` w tym samym pliku wciąż istnieje — to nie jest
rejestr tileId→kafelek, tylko kosmetyczne tłumaczenia pojedynczych segmentów tras dla
idp-basic/intrastat, poza zakresem tej reguły.) To był już czwarty w tym repo przypadek tego
samego wzorca (po `KNOWN_TILE_SEGMENTS` i `navByTile` w `(main)/layout.tsx`) — zanim
dopiszesz kolejną osobną listę tileId→cokolwiek gdziekolwiek w repo, sprawdź najpierw, czy
`TILES`/`nav.ts` już nie mają tej informacji.

## Prefiks `Cortex*` — nasza warstwa abstrakcji nad biblioteką

Komponent w `@cortex/ui` dostaje prefiks `Cortex` (np. `CortexDataGrid`), gdy **opakowuje albo
zastępuje bibliotekę zewnętrzną własną, kontrolowaną warstwą zachowania** — dokłada API, stan albo
reguły, których sama biblioteka nie ma, i które są specyficzne dla tego produktu. Sygnalizuje to
wprost: "to NASZA warstwa, bezpieczna do rozszerzania albo podmiany biblioteki pod spodem
niezależnie od reszty kodu".

Nie każdy komponent w `@cortex/ui` tego wymaga. **Cienki re-eksport prymitywu** (np. `Button`,
`Dialog`, `Select` — shadcn/ui + Radix, patrz reguła 1 wyżej) NIE dostaje prefiksu: to wierne
1:1 owinięcie biblioteki, bez własnej logiki, więc nazwa biblioteki i tak jest tym, co dev
faktycznie dostaje. Prefiks jest zarezerwowany dla przypadków, gdzie odpowiedź na pytanie
"czym różni się to od gołego użycia biblioteki?" jest niepusta.

**`CortexDataGrid`** (`packages/@cortex/ui/src/components/cortex-data-grid.tsx`) to pierwszy,
wzorcowy przykład tej konwencji. Opakowuje TanStack Table własną warstwą: sortowanie klientowe
(`enableSorting: true` per kolumna — opt-in, nie domyślne TanStack "wszystko sortowalne"),
wyszukiwanie globalne (`searchable`), i domyślny brak paginacji ("pokaż wszystko" — paginacja
jest opt-in przez `pageSize`, nigdy zachowaniem domyślnym, bo część ekranów administracyjnych
— np. lista Aplikacji w trybie zmiany kolejności wierszy — wymaga widzieć cały zbiór naraz).
Celowo NIE eksponuje `onRowClick`: to jedyny dozwolony sposób renderowania listy idący naprzód,
więc musi być zgodny z regułą "Listy: row-actions, nie klik-w-wiersz" wyżej z definicji, nie
przez dyscyplinę konsumenta.

Niżej w warstwach zostaje `DataTable` (`components/data-table.tsx`) — surowy, niesortowany,
niefiltrowany wrapper na TanStack (`getCoreRowModel()` i nic więcej), bez własnej logiki poza
renderowaniem wierszy/skeletonu/empty-state. To NIE dostaje prefiksu `Cortex`, bo to właśnie ten
cienki przypadek — i `CortexDataGrid` jest go zbudowany, nie jego zamiennikiem. `DataTable`
został zachowany dla istniejących konsumentów (część z nich używa dziś przestarzałego
`onRowClick` — patrz `@deprecated` przy tym propie w kodzie), ale **nowe ekrany z tabelami mają
używać `CortexDataGrid`**, nie surowego `<table>` ani samego `DataTable`.
