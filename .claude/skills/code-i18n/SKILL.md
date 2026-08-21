---
name: code-i18n
description: Tłumaczenia w cortex-frontend — react-i18next, przestrzeń na kafelek, kontekst `_ctx` dla tłumacza, dwa strażniki architektoniczne. Użyj przy dopisywaniu DOWOLNEGO napisu widocznego dla użytkownika, przy zakładaniu nowego kafelka i przy review pod kątem „czy to nie jest plain text". NIE dla nazw kafelków w bazie (→ code-tile, przestrzeń `tiles`) ani dla promptów do modelu (zostają w języku źródłowym).
---

# code-i18n

## Reguła nadrzędna

**Ani jeden napis widoczny dla użytkownika nie stoi w kodzie.** Nie jest to
postanowienie, tylko własność egzekwowana przez `app/idp/lib/i18n/no-plain-text.test.ts`.
Jeśli dopisujesz napis i nie wiesz, gdzie ma trafić — trafia do przestrzeni
kafelka, nad którym pracujesz.

## Wybór biblioteki i dlaczego nie next-intl

`react-i18next`. Wszystkie 93 strony są `"use client"`, a trasy nie mają
segmentu języka. Idiom `next-intl` to język w URL-u i katalog `[locale]` —
czyli przepisanie każdej trasy. Wybór jest konsekwencją kształtu repo, nie
preferencji; gdyby repo przeszło na RSC i język w ścieżce, decyzja wymaga
ponownego rozstrzygnięcia.

## Kształt

- **Przestrzeń = kafelek.** Jeden plik JSON na kafelek:
  `app/idp/locales/{pl,en}/<kafelek>.json`. Rejestracja w
  `app/idp/lib/i18n/config.ts` — importy plus wpis w `resources`.
- **Zasoby są WBUDOWANE, nie dociągane.** Przełączenie języka nigdy nie
  pokazuje surowych kluczy.
- `SOURCE_LOCALE = "pl"` — język, w którym piszemy.
  `DEFAULT_LOCALE = "pl"` — język na starcie.
  `FALLBACK_LOCALE = "en"` — decyzja Alexa (21.08.2026), z asymetrii skutków:
  luka pokazana Polakowi po angielsku jest zrozumiała, odwrotnie nie.
- Wybór języka: `app/idp/lib/i18n/locale-store.ts` (zustand + persist pod
  `cortex.locale`). `setLocale` woła `i18n.changeLanguage` **w store'rze** —
  nie duplikuj tego w komponencie.

## Kontekst dla tłumacza — `_ctx`

Każdy klucz MUSI mieć wpis w sekcji `_ctx`, **tylko w pliku języka źródłowego**.
i18next nigdy tej sekcji nie odpytuje.

Format: **`typ; co robi[; ograniczenie]`**

```json
"_ctx": {
  "actions.save": "przycisk; zatwierdza formularz klienta; maks. 12 zn.",
  "hub.searchLabel": "etykieta a11y; pole szukania aplikacji na hubie",
  "errors.generic": "komunikat toastu; zapas, gdy serwer nie podał kodu"
}
```

Brak średnika = zostaje sama nazwa miejsca, a to za mało, żeby wybrać słowo
w obcym języku. Test to sprawdza i przepuszcza tylko format z typem.

**Kontekst leży w bloku `_ctx` NA GÓRZE pliku, a napisy niżej** — i tak musi
być, bo i18next wymaga, żeby wartością klucza był napis, więc metadanej nie da
się położyć obok. Skutek uboczny jest dotkliwy: w pliku z 818 kluczami kontekst
i opisywany napis dzieli tysiąc linii. Do czytania ich RAZEM służy:

```
npm run i18n:batch export <język> [przestrzeń…] [--missing]
npm run i18n:batch import <plik.json>
```

Wydaje pozycje w kształcie `{ key, source, context, target }` — dokładnie to,
czego potrzebuje tłumacz albo agent tłumaczący, bez składania dwóch końców
pliku ręcznie. `--missing` wydaje wyłącznie nieprzetłumaczone, czyli normalny
tryb pracy przy dokładaniu języka. Import nie rusza kolejności kluczy
i nie kasuje istniejącego tłumaczenia pozycją z pustym `target`.

## Gdzie `t` nie sięga

**Funkcja, która nie jest komponentem, bierze `t` PARAMETREM.** Fabryki kolumn,
`lib/breadcrumbs.ts`, `hub-tile.ts`. Nie wołaj hooka poza komponentem.

**Stała modułu trzyma KLUCZ, nie napis.** Mapa `kod → etykieta` zbudowana przy
imporcie zamroziłaby się na języku ze startu aplikacji. Stąd nazwy w rodzaju
`INVOICE_STATUS_LABEL_KEYS`, `ERROR_MESSAGE_KEYS`.

**Schemat Zod żyje na poziomie modułu**, gdzie `t` nie istnieje — komunikat
walidacji jest kluczem, tłumaczy go render.

**Poza Reactem** (klient HTTP, funkcja czysta) sięgnij po singleton:
`i18n.t(key, { ns })` albo `i18n.getFixedT(null, ns)`. Wzorzec:
`app/idp/lib/intrastat/api.ts`, `app/idp/lib/breadcrumbs.ts`.

## Serwer nie zna języka użytkownika

Wybór siedzi w `localStorage` przeglądarki. Trasa API nie ma z czego tłumaczyć.

**Serwer zwraca KOD, klient tłumaczy.** Odpowiedź niesie `{ error: "kebab-kod" }`
albo `messageKey` + `messageParams`, nigdy gotowego zdania.
Wzorce: `app/idp/app/api/content-guru/jobs/route.ts`,
`app/idp/lib/document-parser/constraints.ts`, `app/idp/lib/i18n/api-error.ts`.

W `packages/@cortex/api/src/error.ts` **`userMessage` to zdanie od serwera**
(`null`, gdy go nie przysłał), a `message` idzie do logów i spada na
`response.statusText`. Toast czyta `userMessage` — dzięki temu trasa zwracająca
sam kod nie pokazuje frazy protokołu HTTP („Bad Request"). Kolejność
pierwszeństwa pilnuje `packages/@cortex/api/src/toast.test.ts`.

## Nazwy kafelków idą Z BAZY

`applications.name/description` to dane instancji, więc żadna biblioteka i18n
ich nie obejmuje. Obsługuje je przestrzeń `tiles`, kluczowana kodem
uprawnienia, i **istnieje tylko w `en/`** — to jedyna dozwolona asymetria,
whitelistowana w teście parzystości.

**W języku źródłowym wygrywa BAZA**, w pozostałych tłumaczenie z zapasem na
bazie. Bez tej reguły plik w repo przykrywa nazwę, którą admin przed chwilą
wpisał w panelu. Jedno źródło reguły: `app/idp/lib/i18n/tile-names.ts`
(`tileName()`), używane przez hub, okruszki i nawigację narzędzi AI.

## Czego NIE tłumaczyć

| co | dlaczego |
|---|---|
| wartości `z.enum([...])` | jadą na drut; napis bierze się z klucza obok |
| identyfikatory szablonów eksportu | dopasowanie po dosłownej wartości |
| polska proza z backendu użyta jako KLUCZ mapy | zmiana znaku zrywa dopasowanie |
| prompty do modelu i etykiety ról w nich | są instrukcją, nie interfejsem |
| `console.*` | są dla nas, jak komentarze |
| skróty i kody (`CMR`, `POD`, `CN`, `HS`, `SAD`, `VAT`) | takie same w każdym języku |
| dane demo (`features/store-pit/dataset.ts`) | nazwy produktów i kontrahentów |
| `manifest.ts` (`label`/`description`) | wartości POCZĄTKOWE wiersza w bazie |

Napis po polsku BYWA daną. Sprawdź, zanim ruszysz.

## Liczba mnoga — natywne przyrostki, ale we WSZYSTKICH czterech formach

Polski ma cztery formy, angielski dwie, a test parzystości wymaga identycznych
zestawów kluczy. Rozwiązanie, które przechodzi obie bramki naraz: zadeklaruj
`_one`, `_few`, `_many` i `_other` **w obu językach** — angielski po prostu
powtarza swoją formę mnogą w trzech ostatnich.

```json
"eventCount_one":   "{{count}} zdarzenie",
"eventCount_few":   "{{count}} zdarzenia",
"eventCount_many":  "{{count}} zdarzeń",
"eventCount_other": "{{count}} zdarzeń"
```

Wybór formy robi `Intl.PluralRules`; pilnuje tego `app/idp/lib/i18n/plurals.test.ts`
(22 → „22 zdarzenia", nie „22 zdarzeń").

**Obejście `…One` / `…Many` jest ZASTANE i gorsze** — dla 2–4 daje „2 ostrzeżeń"
zamiast „2 ostrzeżenia", a właśnie te liczniki są najczęstsze. Występuje jeszcze
w kilku przestrzeniach z pierwszej fali migracji; przy najbliższej okazji
przenoś je na przyrostki, nie powielaj wzorca w nowym kodzie.

## Daty i liczby

`app/idp/lib/i18n/formats.ts` — jedno miejsce mapujące język na tag `Intl`.
`en → en-GB`, nie `en-US`: `21/08, 10:38` zamiast `08/21, 10:38 AM`.
Komponent czyta `useLocaleStore`, funkcja czysta bierze `locale` parametrem.
Gołe `toLocaleString()` bez argumentu bierze język SYSTEMU — nigdy tak nie rób.

## Pakiety `@cortex/*`

Komponent w pakiecie **może** wołać `useTranslation("ui")`. Pakiet zna wyłącznie
bibliotekę i nazwę przestrzeni — nigdy aplikacji, więc zależność się nie
odwraca. Instancję stawia HOST: aplikacja (`AppProviders`), vitest
(`setupFiles` w `vitest.config.ts`), Ladle (`.ladle/components.tsx`).
Nie przekazuj napisów propsami z wartością domyślną — domyślny język w kodzie
to ten sam błąd, tylko cichszy.

## Czterej strażnicy

`app/idp/lib/i18n/locales-parity.test.ts`
— parzystość przestrzeni i kluczy, `_ctx` dla KAŻDEGO klucza, format `_ctx`,
brak pustych wartości, wyjątek dla `tiles`.

`app/idp/lib/i18n/no-plain-text.test.ts`
— **parsuje parserem TypeScriptu, nie wyrażeniem regularnym.** Trzy reguły:
polszczyzna w dowolnym literale; niezależnie od języka — etykieta wpisana wprost
w tekst JSX albo w atrybut `placeholder`/`title`/`aria-label`/`alt`/`label`;
oraz — w plikach `.ts`, gdzie JSX-a nie ma — napis przypisany do pola, które
z konwencji trafia na ekran (`label`, `title`, `subtitle`, `description`,
`placeholder`…). Trzecia reguła powstała po tym, jak `lib/board/pipeline.ts`
sklejał `"${n} docs"` prosto na kartę kanbana, niewidoczny dla skanu `.tsx`.
Jest WĄSKA celowo: reguła szeroka („żaden polski literał w `.ts`") dawała
374 trafienia w 72 plikach, i niemal wszystkie słusznie — prompty, logi, klucze
dopasowania z backendu, pangram do sprawdzania kroju pisma.
**Nie ma listy wyjątków dla katalogów** — była, doszła do zera i została
skasowana. Dopóki istniała, dopisanie katalogu było najprostszą drogą do
zielonego testu. Wyjątek zostaje możliwy tylko punktowo, przez `NOT_UI_TEXT`:
przypięty do PLIKU I TREŚCI, z uzasadnieniem — nigdy jako wzorzec, żeby nowa
etykieta w tym samym pliku dalej była czerwona.
Nazwa produktu to co innego: tam wzorzec w `ALLOWED` jest właściwy, bo nazwa
ma zostać nazwą wszędzie i przepuszczenie jej globalnie niczego nie ukrywa.

`app/idp/lib/i18n/plurals.test.ts`
— formy 1 / 2–4 / 5+ / ułamek, wyliczane realnie przez `Intl.PluralRules`.

`app/idp/lib/i18n/keys-exist.test.ts`
— **własność ODWROTNA: czy klucz wołany w kodzie w ogóle istnieje.**
Literówka w kluczu jest gorsza od plain textu, bo nie krzyczy — i18next zwraca
sam klucz albo cicho spada na komunikat ogólny, i to wyłącznie w tej jednej
gałęzi, do której nikt nie zajrzał. Sprawdzane są klucze podane literałem;
`t` wiązane jest PER FUNKCJA, bo jeden plik potrafi trzymać dwa komponenty
z dwiema różnymi przestrzeniami.

## Checklista: nowy kafelek

1. `app/idp/locales/{pl,en}/<kafelek>.json` + wpis w `config.ts`.
2. Napisy od razu jako klucze — nie „na razie wpiszę, potem wyciągnę".
3. `_ctx` w `pl` dla każdego klucza, format `typ; co robi[; ograniczenie]`.
4. Stałe modułu i schematy Zod trzymają klucze.
5. Trasy API zwracają kody, nie zdania.
6. `npx vitest run app/idp/lib/i18n` na zielono — wszystkie cztery bramki.

## Szczegóły i pułapki

`REFERENCE.md` obok — konkretne przypadki z migracji sierpnia 2026 razem
z plikami, w których je rozwiązano.
