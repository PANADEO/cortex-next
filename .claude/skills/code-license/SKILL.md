---
name: code-license
description: Licencjonowanie modułów w cortex-frontend — kto ma PRAWO mieć kafelek, kto go WŁĄCZYŁ i kto ma do niego DOSTĘP. Użyj przy `ENABLED_MODULES`/`BOOTSTRAP_MODULES`, "jak zrobić moduł płatnym", dowolnej zmianie w `module-licensing`, oraz przy diagnozie "czemu użytkownik nie widzi kafelka" / "czemu kafelka nie ma w pickerze Dodaj aplikację" (skill rozdziela cztery mechanizmy, które to powodują). NIE dla samego RBAC per użytkownik (→ code-service) ani dla mechaniki seedów (→ code-seed).
---

# code-license

## Cztery pytania, cztery różne mechanizmy — nie mylić ich

Większość pomyłek w tym obszarze bierze się ze sklejenia dwóch z tych czterech w jedno. Kafelek jest widoczny dla użytkownika dopiero, gdy WSZYSTKIE cztery odpowiedzą „tak", i każde ma inne miejsce zapisu:

| Pytanie | Mechanizm | Gdzie żyje odpowiedź | Kto ją zmienia |
|---|---|---|---|
| Czy ten kod w ogóle istnieje? | manifest `defineTile()` | wiersz w `system_config.applications` wstawiony przez `seed-tile-manifests.mjs` | deweloper (kod w repo) |
| Czy ta instancja ma PRAWO go mieć? | `ENABLED_MODULES` | zmienna środowiskowa deployu | sprzedaż/devops przy wdrożeniu |
| Czy ta instancja go WŁĄCZYŁA? | aktywacja | `applications.activated_at` + `is_active` | admin w panelu (albo `BOOTSTRAP_MODULES` przy pierwszym starcie) |
| Czy ten użytkownik ma dostęp? | RBAC | granty ról/użytkowników (`code-service`, `requireTileAccess()`) | admin w panelu |

Praktyczny skutek: **licencja nigdy nie jest odpowiedzią na „użytkownik nie widzi kafelka"**, dopóki nie sprawdzisz, czy wiersz w ogóle został aktywowany. I odwrotnie — kod spoza `ENABLED_MODULES` ma wiersz w bazie (seed wstawia go przy każdym deployu, niezależnie od licencji), więc „jest w bazie" nie znaczy „wolno go włączyć".

## Dwie zmienne, jedna reguła: PRZECIĘCIE, nigdy suma

```
ENABLED_MODULES    — co instancja ma PRAWO mieć.   Puste = bez ograniczeń (fail-open).
BOOTSTRAP_MODULES  — co włączyć od razu przy pierwszym starcie, żeby nie klikać 26 razy.
                     Puste = tylko rdzeń.
```

`BOOTSTRAP_MODULES` **musi** przechodzić przez `ENABLED_MODULES` (`bootstrapActivationPlan()` w `packages/@cortex/db/scripts/module-licensing.mjs`). Bez tego przecięcia zmienna wygody byłaby obejściem licencji na jeden wpis w `.env`. Kod odrzucony wraca w `refused` i seed go **pomija z logiem**, a nie rzuca — łańcuch seedów jest spięty przez `&&`, więc jedna literówka w konfiguracji deployu zostawiłaby instancję bez administratora.

Semantyka pustej wartości jest asymetryczna i celowa: brak `ENABLED_MODULES` = bez ograniczeń (zgodność wstecz, instancja która nie opt-inuje w licencjonowanie działa jak dawniej), brak `BOOTSTRAP_MODULES` = nic nie włączaj.

**Nieustawiona zmienna dociera do kodu w dwóch różnych postaciach, zależnie od pliku compose.** `docker-compose.yml` wypisuje je jawnie jako `VAR: ${VAR:-}`, więc brak wartości to `""`. `docker-compose.image.yml` — czyli realna ścieżka wdrożenia — nie deklaruje ich wcale w `environment:` i podaje przez `env_file: .env`, więc brak wartości to `undefined`. Obie implementacje bramki muszą traktować te dwa przypadki identycznie; dlatego `module-licensing.parity.test.mjs` ma `undefined` i `""` jako osobne wejścia, a nie jedno.

## Bramka istnieje w DWÓCH implementacjach i to jest świadome

| Implementacja | Kto wykonuje | Dlaczego osobna |
|---|---|---|
| `packages/@cortex/service/src/module-licensing.ts` | aplikacja (TS) | normalna ścieżka runtime |
| `packages/@cortex/db/scripts/module-licensing.mjs` | seed | usługa `migrate` startuje z obrazu `runner`, gdzie **nie ma toolchainu TS ani zbudowanego `@cortex/service`** |

Odrzucone: przepisanie seeda na TS (wciąga krok kompilacji do ścieżki deployu, która ma być najprostsza w całym systemie) i import artefaktu buildu (nie ma go w obrazie `runner`).

Kopia ma strażnika — `module-licensing.parity.test.mjs` wykonuje obie implementacje na tej samej tablicy wejść i wymaga zgodności co do znaku. **Zmiana semantyki po jednej stronie musi trafić na drugą**, zwłaszcza kierunku fail-open/fail-closed przy pustej liście: rozjazd byłby cichy i groźny w obie strony (bootstrap aktywujący moduły spoza licencji albo rdzeń zablokowany na instancji bez `ENABLED_MODULES`).

## Gdzie bramka MUSI stać

1. **Serwerowo, nie klientowo.** Filtr w `listUnactivatedNativeApplications()` (`packages/@cortex/service/src/system-config.ts`) idzie do zapytania SQL, przed zwróceniem listy. Klient trywialnie obszedłby filtr klientowy, a to ma być realne ograniczenie na poziomie instancji.
2. **Na ODCZYCIE i na MUTACJI.** To był realny błąd (zamknięty w `00f9a7c`): bramka pilnowała tylko listy kandydatów w pickerze, a wiersz kandydata istnieje w bazie niezależnie od allowlisty — więc `POST /api/system-config/applications/activate` z kodem spoza licencji **aktywował moduł mimo bramki**. Dodając nową ścieżkę dotykającą `applications`, sprawdź obie.
3. **Przed `getDb()`.** Sprawdzenie jest czystym predykatem na env, więc odmowa nie wykonuje ani jednego zapytania i nie może zmienić `is_active`/`show_on_hub`/`activated_at` żadnego wiersza.

## Licencja nigdy nie zapisuje do danych instancji (D4)

Bramka **czyta** i **odmawia**. Nie kasuje wierszy, nie zdejmuje `is_active`, nie chowa kafelka z huba. Instancja, której zabrano kod z `ENABLED_MODULES` po tym, jak admin go już aktywował, zostaje z aktywnym kafelkiem — i to jest zachowanie zamierzone: licencja bramkuje **kandydatów do aktywacji**, nie stan zastany (D2). Odbieranie dostępu wstecz to osobna decyzja produktowa, nie efekt uboczny zmiennej środowiskowej.

## Rdzeń nie przechodzi przez bramkę i nigdy nie może

`system-config` aktywuje się w `seed-system-config.mjs` **poza** `BOOTSTRAP_MODULES` i **poza** `ENABLED_MODULES`. Powód jest praktyczny: `ENABLED_MODULES=content-guru` odcięłoby administratora od panelu, którym mógłby cokolwiek naprawić — czyli licencja zabijałaby instancję zamiast ją ograniczać.

Seed nie pomija tego kroku po cichu — **rzuca i przerywa łańcuch** w trzech przypadkach: wiersza rdzenia nie ma w rejestrze, jest ale nie jest `kind='native'` (więc nie da się go aktywować), albo ma `activated_at` przy `is_active = false` (ktoś rdzeń wyłączył ręcznie). Odwrotnie niż przy `BOOTSTRAP_MODULES`, gdzie pominięcie z logiem jest poprawną odpowiedzią. Uwaga na zakres tej gwarancji: **żaden test nie wykonuje seedów** (`scripts-parse.test.ts` robi tylko `node --check`), więc ta ścieżka jest opisana w kodzie, nie zabezpieczona.

`ilustromat` i `token-usage` aktywują się dziś we własnych seedach — historyczny wzorzec, nie wzór do naśladowania (backlog w Obsidianie: obchodzą bramkę licencyjną).

## Uprawnienie ≠ kafelek

Cztery kody w rejestrze nie renderują własnej karty, tylko odblokowują funkcje gdzie indziej: `ai-tools` i `cortex-cowork` (granty zbiorcze dla rodziny kafelków renderowanej osobno) oraz `intrastat-cn-editor`/`intrastat-config-editor` (przyciski edycji wewnątrz kafelka Intrastat; realną egzekucją zajmuje się zewnętrzny backend FastAPI).

Wyraża to `entitlementOnly: true` w manifeście — `z.literal(true).optional()`, nie `z.boolean()`, bo `entitlementOnly: false` znaczyłoby to samo co pominięcie pola. Domyślną odpowiedzią jest „to jest kafelek": pole zapomniane może najwyżej wystawić uprawnienie na hub (pomyłka widoczna), nigdy ukryć prawdziwy kafelek (pomyłka cicha).

Seed przekłada to na `show_on_hub` **wyłącznie na INSERCIE**. W runtime kolumna należy do admina — może pokazać albo schować dowolny kafelek. Dlatego nazwa pola jest semantyczna (`entitlementOnly`), a nie `showOnHub`: to drugie sugerowałoby, że seed synchronizuje kolumnę przy każdym deployu, czyli dokładnie defekt, którego naprawa ten mechanizm powstał (→ `code-seed`).

## Czego dziś NIE ma — i nie udawaj, że ma

Obecny mechanizm to **MVP na poziomie modułu**: lista kodów w zmiennej środowiskowej, zero kluczy, zero pakietów, zero wygasania. Świadoma decyzja Alexa („pierwszy krok w stronę modularności, nie cały system").

Poza zakresem, ale **zaprojektowane i czekające w backlogu** (`PROJECT/cortex-frontend/ARTIFACTS/licencjonowanie/` w Obsidianie — czytaj stamtąd, zanim zaproponujesz projekt od zera):

- **Wykluczenie build-time.** Wymóg Alexa: kod spoza licencji **nie ma trafiać do klienta**, nie tylko być zablokowany w runtime. Dzisiejsza bramka jest runtime'owa i tego nie realizuje — nie opisuj jej jako spełniającej ten wymóg.
- **Granularność poniżej kafelka.** „Każdy kafelek może być płatny, nawet konkretna funkcjonalność kafelka." Dziś jednostką licencji jest kod modułu i nic mniejszego.
- **Licencja wieczysta + płatne wsparcie/nowe funkcje** jako model handlowy — wpływa na to, co w ogóle ma sens wygaszać.

## Reguły

1. Nowa ścieżka aktywująca/odsłaniająca moduł → bramka po stronie serwera, na odczycie **i** mutacji, przed pierwszym zapytaniem do bazy.
2. Zmiana semantyki `isModuleEnabled()` → obie implementacje w jednym commicie, `module-licensing.parity.test.mjs` zielony.
3. `BOOTSTRAP_MODULES` zawsze przez przecięcie z `ENABLED_MODULES`; kod odrzucony pomijasz z logiem, nie rzucasz.
4. Nigdy nie bramkuj rdzenia (`system-config`).
5. Licencja nie pisze do `applications` — żadnego `update`, `delete` ani `show_on_hub` w ścieżce bramki.
6. Nie dopisuj kolejnej zmiennej „modułowej" do `.env` bez odpowiedzi na pytanie, czym różni się od tych dwóch — one już odpowiadają na dwa różne pytania i trzecie musi mieć własne.
