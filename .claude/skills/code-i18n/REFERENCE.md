# code-i18n — pułapki z migracji (sierpień 2026)

Każda pozycja niżej kosztowała realny błąd albo realny przebieg diagnostyczny.
Trzymane razem, bo są to dokładnie te miejsca, w których „oczywiste" podejście
jest złe.

## 1. Podmiana napisu na `t()` wyrażeniem regularnym psuje JSX

Naiwna zamiana `"Zapisz"` → `t("actions.save")` wewnątrz atrybutu daje
`title="{t("actions.save")}"` — składniowo nieprawidłowe. Cudzysłowy muszą być
częścią wzorca, a wynik `title={t("actions.save")}`. Sprawdzaj `tsc` po każdym
przebiegu automatycznym.

## 2. Tekst JSX bywa PRZERWANY wyrażeniem

```tsx
<p>Twoje konto {email} nie ma uprawnień do tej aplikacji.</p>
```

Ekstraktor liczący jedną linię albo szukający `>…<` bez `{}` widzi tu zero
napisów. Tak przeszły cztery akapity na ekranie logowania i całe zdanie na
ekranie braku dostępu. Gdy wyróżnienie ma przetrwać tłumaczenie, użyj `<Trans>`
z `components` — wzorzec w `app/idp/components/shell/access-denied-screen.tsx`.

## 3. Napis w literale szablonu jest niewidoczny dla wzorca na cudzysłowy

`` aria-label={`Usuń ${tile.label} z ulubionych`} `` — backticki. Znalezione
dopiero po przejściu strażnika na parser (`app/idp/components/shell/hub/tile-card.tsx`).

## 4. `aria-label={warunek ? "a" : "b"}` to nie literał

Atrybut z wyrażeniem warunkowym podaje czytnikowi ekranu dwa gotowe zdania,
a wersja strażnika czytająca tylko `StringLiteral` na wierzchu je przepuszczała
(`app/idp/components/topbar.tsx`). Strażnik schodzi teraz w całe wyrażenie.

## 5. Reguła diakrytyczna jest ślepa na pół problemu

Pilnowanie `[ąćęłńóśźż]` nie widzi:
- **całych kafelków napisanych od razu po angielsku** (`intrastat`, `store-pit`,
  `idp-basic`, `transport-orders`, głębokie ekrany `idp`) — to nie regres, to
  dług, który dopiero druga reguła potrafiła nazwać;
- **polszczyzny bez ani jednego ogonka** — „Wszystkie aplikacje",
  „Nie znaleziono aplikacji", „Funkcjonalnie".

Stąd druga reguła strażnika, niezależna od języka.

## 6. Regex nie odróżni tekstu JSX od generyka TypeScriptu

Wzorzec `>(…)<` czyta `React.ComponentPropsWithoutRef<typeof X>` i odłamki
`) : (` jako napisy. Przy regule diakrytycznej te śmieci były niewidoczne;
przy regule niezależnej od języka dawały setki fałszywych trafień. Parsujemy.

## 7. Plik tłumaczeń przykrył nazwę kafelka wpisaną przez admina

Pierwsza wersja nakładała tłumaczenie także na język źródłowy, więc zmiana
nazwy w panelu była NIEWIDOCZNA. Reguła: w języku źródłowym wygrywa wartość
lokalna (baza dla huba, rejestr dla kafelków z kodu).
Jedno miejsce: `app/idp/lib/i18n/tile-names.ts`.

## 8. Kolumny `name_en`/`description_en` to ślepa uliczka

Przy N językach rozwiązaniem jest tabela
`application_translations (application_id, locale, name, description)`,
nie kolumna na język. Zadanie odłożone, nie wykonane.

## 9. `message ?? statusText` wypycha frazę HTTP na ekran

`ApiError.fromResponse` wypełniał `message` z `response.statusText`, żeby log
nie był pusty. Po HTTP/1.1 Node wypełnia tę frazę ZAWSZE, więc każda trasa
przechodząca na kontrakt „zwracam sam kod" zaczynała pokazywać użytkownikowi
„Bad Request". Rozdzielone: `userMessage` dla użytkownika, `message` dla logów.
Znalezione testem na żywym gnieździe, nie z lektury kodu.

## 10. Ta sama funkcja tłumacząca, napisana ręcznie, dwa razy

`components/idp-basic/status.tsx` i `components/idp-basic/document-preview-panel.tsx`
miały własne tabelki PL→EN dla napisów przychodzących z backendu. Działają dla
dwóch języków i rozpadają się przy trzecim.

Rozwiązanie: **polski napis z backendu zostaje po lewej stronie mapy jako
DANA**, po prawej stoi klucz, a doklejany ogon idzie interpolacją.

```ts
const BACKEND_TEXT_PREFIX_KEYS = [["Niska pewność klasyfikacji:", "backendText.lowConfidence"]] as const
// → t(key, { detail: value.slice(prefix.length).trim() })
```

Trzeci język to wtedy wyłącznie trzeci plik JSON.

## 11. Opcja listy wyboru wpięta w prompt do modelu

W AI Tools wybór użytkownika jest interpolowany do promptu. Stan trzyma KLUCZ,
ekran czyta `t()`, a prompt czyta `getFixedT("pl")` — bo model dostał
instrukcję po polsku i ma ją dostać niezależnie od języka interfejsu.

## 12. `vitest` bez `setupFiles` renderuje komponenty bez i18n

Komponenty w testach nie mają `AppProviders`, więc `t()` zwracało surowe klucze.
`vitest.config.ts` ma globalne `setupFiles: ["./app/idp/lib/i18n/test-setup.ts"]`.
Ladle potrzebuje tego samego (`.ladle/components.tsx`), inaczej stories pokazują
klucze.

## 13. Testy asertujące na widocznym tekście

Migracja napisu zmienia to, co widzi test. Poprawka asercji jest CZĘŚCIĄ
zadania, nie osobnym sprzątaniem. Wyjątek: etykieta test double'a, która nie
przechodzi przez i18n — jej zmiana byłaby udawaniem testu.

## 14. Pełna suita bywa czerwona z powodu obciążenia, nie kodu

Testy `cortex-cowork`/`cortex-governance` chodzą po prawdziwym katalogu na
dysku i przy równoległych przebiegach przekraczają domyślne 5 s. Uruchamiaj
`--testTimeout=20000` (albo `--no-file-parallelism`), zanim uznasz coś za regres.
To znany dług zapisany w backlogu, nie objaw i18n.

## 15. Rozjazdy słownikowe wychodzą dopiero przy zestawieniu kafelków

`Filesystem` przetłumaczone jako „System plików" w jednym kafelku i „dysk
sieciowy" w drugim — bo w jednym to lokalny katalog, a w drugim udział sieciowy.
Nie każdy rozjazd jest błędem; każdy wymaga decyzji. Terminy spoza ustalonej
listy zgłaszaj, zamiast rozstrzygać po cichu.

## 16. Obejście liczby mnogiej okazało się niepotrzebne

Pierwsza fala migracji uznała, że plurali i18nexta użyć się nie da: polski ma
cztery formy, angielski dwie, a test parzystości wymaga identycznych zestawów
kluczy — więc `_few`/`_many` istniałyby tylko po stronie `pl`.

Wniosek był przedwczesny. Wystarczy zadeklarować wszystkie cztery przyrostki
**w obu językach**; angielski powtarza swoją formę mnogą, parzystość jest
zachowana, a `Intl.PluralRules` wybiera właściwą formę. Zastane pary
`…One` / `…Many` dają dla 2–4 „2 ostrzeżeń" i są do wymiany.

## 17. Test, który nie potrafi upaść, niczego nie dowodzi

Pierwsza wersja reguły wielokropka robiła `Object.entries(flatten(bundle))`,
a `flatten()` zwraca `string[]` samych ścieżek kluczy — więc filtr badał NAZWY
kluczy pod kątem trzech kropek i nie mógł nigdy nic znaleźć. Test przechodził
dlatego, że był pusty.

Wyłapały to dwa niezależne agenty. Reguła praktyczna: **nową bramkę sprawdzaj
przez celowe zepsucie** — wstaw naruszenie, zobacz czerwień, cofnij, zobacz
zieleń. Bramka zielona od pierwszego uruchomienia jest podejrzana, nie gotowa.

## 18. Zmiana napisu to także zmiana testów, które go asertują

Ujednolicenie `...` → `…` w plikach tłumaczeń zepsuło dwa testy komponentów
wołające `getByPlaceholderText("Szukaj pliku faktury...")`. Bramki i18n były
zielone, bo one patrzą na pliki tłumaczeń, nie na render. Po każdej zmianie
WARTOŚCI puszczaj pełną suitę, nie sam katalog `lib/i18n`.
