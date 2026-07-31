---
name: code-ui
description: Konwencje UI w cortex-frontend — tylko @cortex/ui + @cortex/styles, zero customowego CSS/inline hex/emoji. Użyj przy pisaniu dowolnego komponentu React/JSX.
---

# code-ui

## Reguły (twarde, bez wyjątków)

1. Komponenty wyłącznie z `@cortex/ui` (shadcn/ui + Radix). Nowy prymityw UI → dodaj do `@cortex/ui`, nie twórz lokalnego odpowiednika w module.
2. Kolory/spacing wyłącznie przez tokeny `@cortex/styles` (CSS variables) — zero inline hex (`#4A90E2` itd.), zero magicznych wartości Tailwind poza tokenami.
3. Zero emoji w UI copy, komentarzach, komunikatach błędów — produkt dla regulowanych klientów enterprise, ma wyglądać intencjonalnie.
4. UI copy po polsku, identyfikatory kodu po angielsku (zmienne, funkcje, nazwy plików).
5. Logo (`app/idp/public/cortex-logo.png`) i kolor marki `cortex` (`#4A90E2` w `tailwind.config.ts`) — nie wymyślać alternatyw.

## Nagłówki stron

`st.subheader`-style hierarchia nieaktualna tu (to reguła ze świata Streamlit) — w Next.js: jeden spójny wzorzec nagłówka strony na kafelek, patrz istniejące `*Form` w `ai-tool-workspace.tsx` jako referencja układu (label + opis + pola + wynik).

## Dark mode

Jeden asset, jeden mechanizm: `<Image className="dark:invert dark:hue-rotate-180" />` dla logo. Nie dodawać osobnych assetów per motyw bez wyraźnej potrzeby.

## Listy: row-actions, nie klik-w-wiersz

Wiersz tabeli/listy **nigdy nie jest sam w sobie interaktywny** — bez `onClick`/`tabIndex`/`role="link"`/ręcznego `onKeyDown` na `<tr>`. Nawigacja i akcje idą wyłącznie przez dedykowany element w ostatniej kolumnie (nagłówek pusty: `<th className="px-4 py-2" />`), wyrównanej do prawej krawędzi (`text-right`). Klik w resztę wiersza nic nie robi — to nie jest zaniedbanie, to świadomy brak funkcji tam, gdzie nie ma jej po co budować.

Dobór elementu zależy od liczby akcji i ich dostępności:

- **Jedna akcja** (np. "przejdź do szczegółów", "zmień role") → jeden przycisk (`Button size="sm"` z tekstem, albo `Button size="icon" variant="ghost"` z samą ikoną dla nawigacji drill-down).
- **Dwie akcje, z których jedna bywa zablokowana z wyjaśnieniem** (np. Edytuj zawsze dostępne, Usuń zablokowane dla wiersza chronionego) → dwa osobne przyciski-ikony obok siebie. Stan zablokowany (`disabled` + `title`/tooltip tłumaczący dlaczego) ma być widoczny wprost, nie schowany w menu — użytkownik ma wiedzieć, że coś jest niemożliwe, zanim kliknie, nie dopiero po otwarciu menu.
- **Dwie akcje o równej dostępności, albo trzy i więcej** → jeden przycisk-trigger (`Button size="icon" variant="ghost"` z `MoreHorizontal`) otwierający `DropdownMenu` (`@cortex/ui`).

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
