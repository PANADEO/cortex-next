# Rejestr kafelków

Status: skonsolidowany (faza K, 08.08.2026) — rejestrem jest baza, zasilana z manifestów. Kontekst decyzji: Obsidian `PROJECT/cortex-frontend/ARTIFACTS/licencjonowanie/`.

## Trzy rodzaje kafelka (`@cortex/tile-sdk`)

```ts
type TileKind = "native" | "external-link" | "iframe"
```

`native` — strona w tym appie. `external-link` — link/`target=_blank"` do zewnętrznego serwisu (dziś: OpenWebUI). `iframe` — jak wyżej, osadzone w chrome shellu (Faza 2, nieużywane jeszcze).

## Stan dziś — jeden rejestr, baza (od fazy K, 08.08.2026)

Rejestrem kafelka jest **tabela `system_config.applications`**, zasilana z manifestów (`defineTile()`) przez `packages/@cortex/db/scripts/seed-tile-manifests.mjs`. Hub renderuje z niej (`GET /api/hub/tiles`), nie z kodu.

Co zostało z dawnych dwóch rejestrów:

1. `app/idp/lib/tiles.ts` — **już nie jest rejestrem**. Żyje jako źródło nawigacji, palety poleceń i stałych kategorii. Kafelki `task-chat` (Cortex Cowork) nadal nie są tu — dochodzą z governance store w runtime.
2. `app/idp/lib/ai-tools/registry.ts` (`AI_TOOL_DEFINITIONS`) — nadal osobny, ale wyłącznie dla kształtu narzędzia „text-tool" (formularz, prompt, wynik). Rejestracja tych narzędzi idzie tą samą drogą co reszta: manifest w `app/idp/lib/ai-tools/manifests/<id>.manifest.ts`.

Konsolidacja `tiles.ts` z bazą jest osobnym, otwartym zadaniem — ale nie jest już blokerem niczego, bo o uprawnieniach i o hubie rozstrzyga wyłącznie baza.

### Podział ról po unifikacji bramek (30.07.2026)

Rozdzielenie, o które łatwo się potknąć: **`tiles.ts` odpowiada na „jak kafelek wygląda i gdzie prowadzi", tabela `applications` na „czy wolno"**. Powłoka (`GET /api/me/access`) czyta WYŁĄCZNIE bazę; `tiles.ts` nie ma już żadnego wpływu na uprawnienia (allowlista `AUTHORIZED_APP_CODES` zniknęła razem z `app/idp/app/api/_lib/access.ts`).

Praktyczne skutki:

- Kod nieobecny w `applications` **nigdy** nie trafi do `apps` — SQL go nie zwróci. Nowy kafelek wymaga wiersza w rejestrze; zakłada go `packages/@cortex/db/scripts/seed-tile-manifests.mjs` z manifestu kafelka (`defineTile()`), jako NIEAKTYWNEGO kandydata. Ręcznej listy kodów w seedzie nie ma już wcale (K3).
- Kafelek z kodem, ale bez manifestu w barrelu `app/idp/lib/tile-manifests.ts`, nie zarejestruje się w żadnej instancji i jest nieosiągalny dla wszystkich — zachowanie zamierzone (fail-closed), nie usterka. Pilnuje tego `app/idp/lib/tile-manifests-completeness.test.ts`.
- Kod, który jest **uprawnieniem, a nie kafelkiem**, deklaruje to w manifeście przez `entitlementOnly: true` (a nie przez nieobecność w `TILES`, jak przed fazą K). Nie renderuje własnej karty, ale otwiera funkcje w środku innego kafelka. Dziś cztery takie: `ai-tools` i `cortex-cowork` (granty zbiorcze — bramkują rodzinę kafelków renderowaną gdzie indziej) oraz `intrastat-cn-editor` / `intrastat-config-editor` (przyciski edycji w Intrastacie; realną egzekucją zajmuje się zewnętrzny backend FastAPI).
- Wiersz `native` w `applications` bez odpowiadającego manifestu jest **osierocony** i ma być głośny — pilnuje tego `packages/@cortex/db/scripts/tile-registry-parity.test.ts`.

> [!note] `show_on_hub` ma już realnego konsumenta
> Kolumna odróżnia „kafelek" od „samego uprawnienia" (`false` dla tych czterech kodów, `true` domyślnie dla reszty). Do fazy K nie czytał jej nikt, bo hub renderował z `TILES`. Dziś zapytanie huba filtruje `is_active = true AND show_on_hub = true` (`packages/@cortex/service/src/system-config.ts`), a wartość początkową ustawia manifestowe `entitlementOnly` — wyłącznie na INSERCIE, bo w runtime kolumna należy do admina.

## Rejestr edytowalny z UI (wymóg Cezarego, 28.07.2026) — zrealizowane

"Ustawianie kafelków w instancji ma być z UI, nie edycją plików." Zrealizowane: tabela `applications` (z `route`/`kind`/`url`) w schemacie `system_config` (`@cortex/db`) + ekran CRUD w module Konfiguracja Systemu — łącznie z kolejnością kafelków ("Zmień kolejność" na liście Aplikacji). Nie przez plik `services-config.json` (wzorzec starego `cortex-box-prototype`, świadomie porzucony).

Podział własności, który z tego wynika i o który najłatwiej się potknąć: **manifest podaje wartość POCZĄTKOWĄ, admin jest właścicielem w runtime.** Pola prezentacyjne (`name`, `description`, `icon`, `color`, kategorie, `sort_order`, `show_on_hub`) seed wpisuje wyłącznie przy pierwszym INSERCIE i nigdy w `on conflict do update set` — inaczej edycja admina wracałaby do wartości z kodu przy każdym wdrożeniu. To był realny defekt (kategorie wracały po deployu), usunięty w K3.

## Ścieżka pod przyszłą samodzielność klientów (nie teraz, ale projektować z myślą o tym)

Zbadane wzorce branżowe (Shopify/Salesforce/Retool/Notion): bezpieczna droga to zewnętrzny serwis klienta + cienki kontrakt (`external-link`/`iframe`), nigdy wykonywanie cudzego kodu w naszym procesie. Rejestr kafelków projektowany TERAZ z polem `kind` już to wspiera — klient dopisujący własny kafelek to w praktyce nowy wiersz `external-link` wskazujący na jego własny, osobno hostowany serwis. Nic więcej nie trzeba budować, żeby to było możliwe w przyszłości.
